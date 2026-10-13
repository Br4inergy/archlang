import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "../src/parser.js";
import { resolve } from "../src/ir.js";
import { toScene } from "../src/scene-build.js";
import { toDxf } from "../src/export/dxf.js";
import { compile } from "../src/index.js";
import { RENDER_PASSES, aiaLayer, layerOf } from "../src/scene.js";
import type { World } from "../src/world.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studio = readFileSync(join(__dirname, "..", "examples", "studio.arch"), "utf8");
const dxfSource = readFileSync(join(__dirname, "..", "src", "export", "dxf.ts"), "utf8");

function dxfOf(src: string): string {
  const { plan } = parse(src);
  return toDxf(toScene(resolve(plan!).ir));
}

describe("DXF export", () => {
  it("emits a well-formed ASCII DXF document", () => {
    const dxf = dxfOf(studio);
    expect(dxf.startsWith("0\nSECTION")).toBe(true);
    expect(dxf).toContain("HEADER");
    expect(dxf).toContain("$ACADVER");
    expect(dxf).toContain("ENTITIES");
    expect(dxf).toContain("ENDSEC");
    expect(dxf.trimEnd().endsWith("EOF")).toBe(true);
  });

  it("renders walls/rooms as LINEs, doors as ARCs, and labels as TEXT", () => {
    const dxf = dxfOf(studio);
    expect(dxf).toContain("\nLINE\n");
    expect(dxf).toContain("\nARC\n"); // door swing arcs
    expect(dxf).toContain("\nTEXT\n");
    expect(dxf).toContain("Bedroom"); // room label text
    expect(dxf).toContain("\nA-WALL-EXTR\n"); // AIA exterior wall layer
    expect(dxf).toContain("\nA-WALL-INTR\n"); // AIA interior wall layer
    expect(dxf).toContain("A-FLOR"); // AIA floor (room) layer
  });

  it("is deterministic (pure, byte-identical across calls)", () => {
    expect(dxfOf(studio)).toBe(dxfOf(studio));
  });

  it("flips Y so the plan is right-side-up in CAD (negated coordinates present)", () => {
    // studio has geometry at positive y; flipped DXF must contain negative y values.
    const dxf = dxfOf(studio);
    expect(/\n20\n-\d/.test(dxf)).toBe(true);
  });

  it("emits one door ARC per door", () => {
    const src = [
      'plan "D" {',
      "  wall exterior thickness 200 { (0,0) (4000,0) }",
      "  door id=d at (2000,0) width 900 wall exterior hinge left swing in",
      "}",
    ].join("\n");
    const dxf = dxfOf(src);
    expect((dxf.match(/\nARC\n/g) ?? []).length).toBe(1);
  });

  it("does not throw on an empty plan", () => {
    expect(() => dxfOf('plan "Empty" { }')).not.toThrow();
  });

  it("emits a real HATCH entity for wall poché (pattern name, scale, angle, boundary)", () => {
    const dxf = dxfOf(`plan "H" { wall w thickness 400 material brick scale 2 angle 30 { (0,0) (4000,0) } }`);
    // Version must support HATCH (post-R12).
    expect(dxf).toContain("AC1015");
    expect(dxf).toContain("\nHATCH\n");
    expect(dxf).toContain("AcDbHatch");
    expect(dxf).toContain("\nANSI32\n"); // predefined pattern name (group 2)
    // Pattern scale (41) and angle (52) round-trip the DSL values.
    expect(/\n41\n2\b/.test(dxf)).toBe(true);
    expect(/\n52\n30\b/.test(dxf)).toBe(true);
    // A polyline boundary path (92=2) with vertices (93).
    expect(/\n92\n2\n/.test(dxf)).toBe(true);
    expect(/\n93\n\d/.test(dxf)).toBe(true);
  });

  it("emits one HATCH per wall hatch group", () => {
    const dxf = dxfOf(`plan "H" {
      wall a thickness 400 material brick { (0,0) (4000,0) }
      wall b thickness 400 material concrete { (0,2000) (4000,2000) }
    }`);
    expect((dxf.match(/\nHATCH\n/g) ?? []).length).toBe(2);
  });

  it("re-derives no element geometry (door swing math lives only in the element)", () => {
    // The backend is a pure Scene serializer: it must not recompute door swing,
    // hinges, leaves, panes, or arc trig — those come from the element primitives.
    for (const forbidden of [/\bhinge\b/, /\bswing\b/, /\bleaf/i, /jamb/i, /atan2/, /Math\.PI/]) {
      expect(dxfSource).not.toMatch(forbidden);
    }
    expect(dxfSource).not.toContain("emitDoor");
    expect(dxfSource).not.toContain("emitWindow");
    expect(dxfSource).not.toContain("emitDim");
  });

  it("a door's swing arc shares the element code path (same arc as SVG)", () => {
    const src = [
      'plan "D" {',
      "  wall exterior thickness 200 { (0,0) (4000,0) }",
      "  door id=d at (2000,0) width 900 wall exterior hinge left swing in",
      "}",
    ].join("\n");
    const { plan } = parse(src);
    const scene = toScene(resolve(plan!).ir);
    const arcs = scene.nodes.filter((n) => n.prim.t === "arc");
    expect(arcs).toHaveLength(1); // one arc primitive, consumed identically by SVG + DXF
  });
});

/*
 * AIA CAD layer naming — the mapping a CAD consumer keys its imports to.
 *
 * Two sources of truth, and these tests hold them closed against each other rather
 * than restating either: `aiaLayer()`/`RENDER_PASSES` (`src/scene.ts`) decide which
 * layer a pass lands on, and the DXF LAYER table (`AIA_LAYERS`, `src/export/dxf.ts`)
 * decides which layers exist. Nothing below retypes the table — the declared set is
 * read back out of real output, and the pass→name map is a reviewed snapshot
 * *generated* from `aiaLayer` (see the note on that test before you `-u` it).
 */

/** DXF is a strict alternating group-code / value line stream — read it as pairs. */
function dxfPairs(dxf: string): [number, string][] {
  const lines = dxf.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const out: [number, string][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) out.push([Number(lines[i]), lines[i + 1]!]);
  return out;
}

/** Layer names the TABLES→LAYER table declares, in table order. */
function declaredLayers(dxf: string): string[] {
  const p = dxfPairs(dxf);
  const out: string[] = [];
  for (let i = 0; i + 1 < p.length; i++) {
    // A layer record is `0 LAYER` / `2 <name>`. The table header is `0 TABLE` / `2 LAYER`,
    // so it never matches; nor does the LTYPE table's `0 LTYPE` / `2 <name>`.
    if (p[i]![0] === 0 && p[i]![1] === "LAYER" && p[i + 1]![0] === 2) out.push(p[i + 1]![1]);
  }
  return out;
}

/** Layer names entities actually reference (group code 8, inside ENTITIES). */
function entityLayers(dxf: string): Set<string> {
  const p = dxfPairs(dxf);
  const start = p.findIndex(([c, v]) => c === 2 && v === "ENTITIES");
  const out = new Set<string>();
  for (let i = start; i < p.length; i++) if (p[i]![0] === 8) out.add(p[i]![1]);
  return out;
}

/**
 * One plan that puts a node on **every** `RenderPass` and exercises every per-node
 * `layerName` override. The first test below is its own guard: if a grammar change makes
 * this stop covering a pass, the layer assertions fail loudly instead of silently
 * narrowing.
 *
 * ## Why it now carries a roof, a void, ground and a fence
 *
 * Because a closure test is only as strong as its fixture, and this one proved it. The
 * assertions below have said "declares every layer an entity actually references" for
 * a long time — and `A-ROOF` still shipped without a row in `AIA_LAYERS`, so
 * `examples/bungalow.arch` exported a DXF referencing an undeclared layer for two
 * releases while this suite stayed green. Nothing was wrong with the assertion; the
 * fixture simply had no `roof` in it, so there was no entity to catch.
 *
 * The rule that follows, and the reason this comment exists: **an element that sets a
 * `layerName` must appear HERE, in this plan, on the same commit that introduces it.**
 * The pass-coverage guard cannot notice — `roof` rides `annotations`, which was already
 * covered — so nothing else will.
 */
const allPasses = `plan "Layers" {
  paper A3
  axes { x at 0, 4000, 8000 y at 0, 6000 }
  site {
    street south
    boundary (-4000,-4000) (14000,-4000) (14000,11000) (-4000,11000)
  }
  wall id=shell exterior thickness 200 { (0,0) (8000,0) (8000,6000) (0,6000) close }
  wall part thickness 100 { (4000,0) (4000,6000) }
  room id=r1 at (0,0) size 4000x6000 label "Hall"
  room id=r2 at (4000,0) size 4000x6000 label "Office"
  door at (2000,0) width 900 wall exterior
  opening at (4000,3000) width 800 wall part
  window at (6000,0) width 1200 wall exterior
  column at (500,500) size 300x300
  furniture desk at (1000,1000) size 600x600 label "Desk"
  stair id=s at (6500,4000) size 1200x2400 dir up
  elevator id=e at (500,4000) size 1600x1600
  roof overhang 600 wall shell
  void id=well at (2000,2000) size 1000x1000
  outdoor lawn at (-3000,-3000) size 5000x5000
  outdoor paving at (9000,0) size 3000x3000
  outdoor balcony at (0,6000) size 3000x1500
  fence post { (-4000,-4000) (14000,-4000) }
  dims auto
  schedule rooms
  legend
}`;

describe("AIA CAD layers", () => {
  const scene = compile(allPasses, { noCache: true }).scene!;
  const dxf = toDxf(scene);

  it("the fixture compiles clean and covers every RenderPass", () => {
    expect(compile(allPasses, { noCache: true }).errors).toEqual([]);
    const covered = new Set(scene.nodes.map((n) => n.layer));
    expect(RENDER_PASSES.filter((p) => !covered.has(p))).toEqual([]);
  });

  it("pins the RenderPass → AIA layer map (generated from aiaLayer; re-bless, never -u)", () => {
    // Derived from the source of truth, not retyped: a rename on either side shows up
    // here as a reviewable diff. Update it only when the mapping change is the intent.
    expect(Object.fromEntries(RENDER_PASSES.map((p) => [p, aiaLayer(p)]))).toMatchInlineSnapshot(`
      {
        "annotations": "A-ANNO",
        "axes": "A-GRID",
        "dims": "A-ANNO-DIMS",
        "doors": "A-DOOR",
        "floor": "A-FLOR",
        "furniture": "A-FURN",
        "labels": "A-ANNO-TEXT",
        "openings": "A-DOOR",
        "wallFace": "A-WALL",
        "wallFill": "A-WALL",
        "windows": "A-GLAZ",
      }
    `);
  });

  it("declares every pass's AIA layer in the LAYER table (the wall passes as their two class layers)", () => {
    // The wall passes' default `A-WALL` is what the SVG's layer groups use; the DXF files
    // a compiled plan's wall nodes on `A-WALL-EXTR`/`A-WALL-INTR` instead (see the
    // "DXF units and wall layers" suite), so it is those two a CAD user must find.
    const declared = declaredLayers(dxf);
    for (const pass of RENDER_PASSES) {
      if (pass === "wallFill" || pass === "wallFace") continue;
      expect(declared).toContain(aiaLayer(pass));
    }
    expect(declared).toContain("A-WALL-EXTR");
    expect(declared).toContain("A-WALL-INTR");
    expect(declared).not.toContain("A-WALL");
  });

  it("declares every layer an entity actually references", () => {
    // The gap this closed: `stair`/`elevator` draw on the A-FLOR-* shaft sublayers via
    // `layerName`, and the LAYER table used to declare only the pass defaults.
    const declared = new Set(declaredLayers(dxf));
    expect([...entityLayers(dxf)].filter((l) => !declared.has(l))).toEqual([]);
  });

  it("declares no dead layer — every name is one a node can land on", () => {
    // A wall class layer is reachable when an entity of this fixture lands on it — the
    // fixture has an `exterior` shell and a `part` partition, so both must.
    const reachable = new Set<string>([
      ...RENDER_PASSES.map(aiaLayer),
      ...scene.nodes.map(layerOf),
      ...entityLayers(dxf),
    ]);
    expect(entityLayers(dxf)).toContain("A-WALL-EXTR");
    expect(entityLayers(dxf)).toContain("A-WALL-INTR");
    expect(declaredLayers(dxf).filter((l) => !reachable.has(l))).toEqual([]);
  });

  it("names every layer in the NCS form: a discipline letter + a 4-char major group [+ a 4-char minor]", () => {
    // The discipline prefix was hardcoded `A-` while architectural was the only one. The
    // ground layers use the other two standard disciplines and earn them: `L-` is
    // LANDSCAPE (a lawn, a planting bed, hard landscape) and `C-` is CIVIL (the property
    // line). A CAD user freezes by discipline, so forcing a lawn onto an `A-` layer to
    // satisfy a regex would have hidden it behind the wrong switch — the rule is widened
    // to the three disciplines this tree uses, not to "any letter".
    const names = [...new Set([...declaredLayers(dxf), ...RENDER_PASSES.map(aiaLayer)])];
    expect(names.filter((n) => !/^[ACL]-[A-Z]{4}(-[A-Z]{4})?$/.test(n))).toEqual([]);
  });

  it("declares each layer exactly once", () => {
    const declared = declaredLayers(dxf);
    expect(declared).toEqual([...new Set(declared)]);
  });
});

/*
 * DXF units and wall layers.
 *
 * Units: the HEADER says millimetres (`$INSUNITS` 4) and metric (`$MEASUREMENT` 1), so a CAD
 * program inserts the plan at true size instead of "unitless".
 *
 * Walls: a compiled plan's wall nodes are RE-FILED, never redrawn — an `exterior` wall's
 * share of the joined outline and poché goes on `A-WALL-EXTR`, every other wall's on
 * `A-WALL-INTR`. The oracle for "never redrawn" is the plain export of the same Scene
 * without its `walls` (a hand-built Scene), which writes every wall node as itself on
 * `A-WALL`: the two must carry the same non-wall entities, the same face length, the same
 * hatched area, and every split face line must lie on a plain one.
 */

/** One entity: its type, its layer (group 8) and its remaining group pairs. */
interface Ent {
  type: string;
  layer: string;
  body: [number, string][];
}

function dxfEntities(dxf: string): Ent[] {
  const p = dxfPairs(dxf);
  const start = p.findIndex(([c, v]) => c === 2 && v === "ENTITIES");
  const out: Ent[] = [];
  let cur: Ent | null = null;
  for (let i = start + 1; i < p.length; i++) {
    const [c, v] = p[i]!;
    if (c === 0) {
      if (cur) out.push(cur);
      cur = null;
      if (v === "ENDSEC") break;
      cur = { type: v, layer: "", body: [] };
    } else if (cur) {
      if (c === 8 && cur.layer === "") cur.layer = v;
      else cur.body.push([c, v]);
    }
  }
  return out;
}

/** The HEADER section's `$VAR` → `[code, value]` pairs. */
function headerVars(dxf: string): Map<string, [number, string]> {
  const p = dxfPairs(dxf);
  const out = new Map<string, [number, string]>();
  const start = p.findIndex(([c, v]) => c === 2 && v === "HEADER");
  for (let i = start + 1; i + 1 < p.length && !(p[i]![0] === 0 && p[i]![1] === "ENDSEC"); i++) {
    if (p[i]![0] === 9) out.set(p[i]![1], p[i + 1]!);
  }
  return out;
}

const groupNum = (e: Ent, code: number): number => Number(e.body.find(([c]) => c === code)![1]);
const isWallEnt = (e: Ent): boolean => e.layer.startsWith("A-WALL");
const faceLength = (es: readonly Ent[]): number =>
  es.reduce((s, e) => {
    if (e.type === "LINE") {
      return s + Math.hypot(groupNum(e, 11) - groupNum(e, 10), groupNum(e, 21) - groupNum(e, 20));
    }
    if (e.type === "ARC") {
      const sweep = (((groupNum(e, 51) - groupNum(e, 50)) % 360) + 360) % 360;
      return s + (groupNum(e, 40) * sweep * Math.PI) / 180;
    }
    return s;
  }, 0);

/** Net hatched area: every HATCH boundary (the 10/20 vertices after each 93 count), signed. */
const hatchArea = (es: readonly Ent[]): number => {
  let total = 0;
  for (const e of es.filter((x) => x.type === "HATCH")) {
    let pts: [number, number][] = [];
    let left = 0;
    for (let i = 0; i < e.body.length; i++) {
      const [c, v] = e.body[i]!;
      if (c === 93) left = Number(v);
      else if (c === 10 && left > 0) {
        pts.push([Number(v), Number(e.body[i + 1]![1])]);
        if (--left === 0) {
          let a = 0;
          for (let k = 0; k < pts.length; k++) {
            const [x1, y1] = pts[k]!;
            const [x2, y2] = pts[(k + 1) % pts.length]!;
            a += x1 * y2 - x2 * y1;
          }
          total += a / 2;
          pts = [];
        }
      }
    }
  }
  return total;
};

type AnyScene = NonNullable<ReturnType<typeof compile>["scene"]>;

/** A World over `examples/`, so the two plans that `import` are covered, not skipped. */
const examplesWorld: World = {
  read: (p) => {
    try {
      return readFileSync(join(__dirname, "..", "examples", p), "utf8");
    } catch {
      return null;
    }
  },
  now: () => new Date(0),
};

/** Every page's Scene of a compiled example (one for a single-storey plan). */
function scenesOf(src: string): AnyScene[] {
  const r = compile(src, { noCache: true, world: examplesWorld });
  expect(r.errors).toEqual([]);
  return r.pages ? r.pages.map((p) => p.scene) : [r.scene!];
}

/** The same Scene as a hand-built one would be: no `walls`, so every node exports as itself. */
function plain(scene: AnyScene): AnyScene {
  const { walls: _walls, ...rest } = scene;
  return rest;
}

const EXAMPLES = readdirSync(join(__dirname, "..", "examples"))
  .filter((f) => f.endsWith(".arch"))
  .sort();
const exampleSrc = (f: string): string => readFileSync(join(__dirname, "..", "examples", f), "utf8");

describe("DXF units and wall layers", () => {
  it("declares millimetres and metric in the HEADER, for the AC1015 the header declares", () => {
    for (const src of [studio, 'plan "Empty" { }']) {
      const vars = headerVars(dxfOf(src));
      expect(vars.get("$ACADVER")).toEqual([1, "AC1015"]);
      expect(vars.get("$INSUNITS")).toEqual([70, "4"]);
      expect(vars.get("$MEASUREMENT")).toEqual([70, "1"]);
    }
  });

  it("files an `exterior` wall on A-WALL-EXTR and every other category on A-WALL-INTR", () => {
    const layersOf = (src: string) => [
      ...new Set(
        dxfEntities(dxfOf(src))
          .filter(isWallEnt)
          .map((e) => e.layer),
      ),
    ];
    const ring = "{ (0,0) (4000,0) (4000,3000) (0,3000) close }";
    expect(layersOf(`plan "E" { wall id=shell exterior thickness 200 ${ring} }`)).toEqual(["A-WALL-EXTR"]);
    expect(layersOf(`plan "P" { wall partition thickness 100 ${ring} }`)).toEqual(["A-WALL-INTR"]);
    // Any category the core does not read as `exterior` is interior — the rule the roof
    // ring, the door access graph and `dims auto` already use.
    expect(layersOf(`plan "O" { wall outer thickness 200 ${ring} }`)).toEqual(["A-WALL-INTR"]);
  });

  it("puts examples/studio.arch's walls on both layers, and nothing on A-WALL", () => {
    const walls = dxfEntities(dxfOf(studio)).filter(isWallEnt);
    expect(walls.filter((e) => e.layer === "A-WALL-EXTR").length).toBeGreaterThanOrEqual(1);
    expect(walls.filter((e) => e.layer === "A-WALL-INTR").length).toBeGreaterThanOrEqual(1);
    expect(walls.filter((e) => e.layer === "A-WALL-EXTR" && e.type === "HATCH")).toHaveLength(1);
    expect(walls.filter((e) => e.layer === "A-WALL-INTR" && e.type === "HATCH")).toHaveLength(1);
    expect(walls.filter((e) => e.layer === "A-WALL")).toEqual([]);
  });

  it("still exports a wall-less plan and a single-room plan", () => {
    const ring = "wall exterior thickness 200 { (0,0) (3000,0) (3000,3000) (0,3000) close }";
    for (const src of [
      'plan "Empty" { }',
      'plan "Room" { room at (0,0) size 3000x3000 label "Hall" }',
      `plan "One" { ${ring} room at (0,0) size 3000x3000 }`,
    ]) {
      const dxf = dxfOf(src);
      expect(dxf.trimEnd().endsWith("EOF")).toBe(true);
      const declared = declaredLayers(dxf);
      expect(declared).toContain("A-WALL-EXTR");
      expect(declared).toContain("A-WALL-INTR");
      expect(declared).not.toContain("A-WALL");
      expect(dxfEntities(dxf).filter((e) => e.layer === "A-WALL")).toEqual([]);
    }
    // The ring is all exterior: its 8 face LINEs and 1 HATCH, and an empty interior layer.
    const one = dxfEntities(dxfOf(`plan "One" { ${ring} }`));
    expect(one.filter((e) => e.layer === "A-WALL-EXTR").map((e) => e.type)).toEqual([
      "HATCH",
      ...Array<string>(8).fill("LINE"),
    ]);
    expect(one.filter((e) => e.layer === "A-WALL-INTR")).toEqual([]);
  });

  it("a Scene without `walls` (hand-built) exports its wall nodes as before, on A-WALL, declared once", () => {
    const scene = toScene(resolve(parse(studio).plan!).ir);
    expect(scene.walls?.length).toBeGreaterThan(0);
    const dxf = toDxf(plain(scene));
    expect(declaredLayers(dxf).filter((l) => l === "A-WALL")).toHaveLength(1);
    const walls = dxfEntities(dxf).filter(isWallEnt);
    expect(walls.length).toBeGreaterThan(0);
    expect(walls.every((e) => e.layer === "A-WALL")).toBe(true);
  });

  it("re-files only the nodes the walls drew: a wall-pass node added by hand stays itself, on A-WALL", () => {
    const scene = toScene(resolve(parse(studio).plan!).ir);
    const before = dxfEntities(toDxf(scene)).filter(isWallEnt);
    scene.nodes.push({
      layer: "wallFace",
      prim: { t: "line", a: { x: 0, y: 0 }, b: { x: 1000, y: 0 } },
      paint: { stroke: scene.theme.wallStroke, width: scene.sizes.wallStroke },
    });
    const dxf = toDxf(scene);
    const after = dxfEntities(dxf).filter(isWallEnt);
    expect(after.slice(0, before.length)).toEqual(before); // the drawn walls are still split
    expect(after.slice(before.length).map((e) => [e.type, e.layer])).toEqual([["LINE", "A-WALL"]]);
    expect(declaredLayers(dxf).filter((l) => l === "A-WALL")).toHaveLength(1);
  });

  it("a one-class plan's entities are the plain export's, byte for byte, with only the layer renamed", () => {
    const src = `plan "E" {
      wall id=a exterior thickness 200 { (0,0) (6000,0) (6000,4000) (0,4000) close }
      wall exterior thickness 200 { (3000,0) (3000,4000) }
      door at (1500,0) width 900 wall a
    }`;
    const scene = compile(src, { noCache: true }).scene!;
    const entities = (d: string): string => d.slice(d.indexOf("\nENTITIES\n"));
    expect(entities(toDxf(scene))).toBe(
      entities(toDxf(plain(scene))).replaceAll("\n8\nA-WALL\n", "\n8\nA-WALL-EXTR\n"),
    );
  });

  // The partition oracle, over every storey of every shipped example.
  for (const f of EXAMPLES) {
    it(`${f}: the wall split re-files the drawn walls and adds nothing`, () => {
      for (const scene of scenesOf(exampleSrc(f))) {
        const split = dxfEntities(toDxf(scene));
        const base = dxfEntities(toDxf(plain(scene)));
        // Every wall entity is on exactly one of the two wall layers.
        for (const e of split.filter(isWallEnt)) expect(["A-WALL-EXTR", "A-WALL-INTR"]).toContain(e.layer);
        // Everything that is not a wall is untouched, in order.
        expect(split.filter((e) => !isWallEnt(e))).toEqual(base.filter((e) => !isWallEnt(e)));
        const sw = split.filter(isWallEnt);
        const bw = base.filter(isWallEnt);
        // The same face length and the same hatched area: a partition of the drawing. The
        // area is equal up to two honest approximations, hence relative: each boundary vertex
        // is printed at 4 dp, and a HATCH boundary is a POLYGON, so a curved wall's arc cut
        // where the class changes is tessellated as two pieces rather than one (aquarium:
        // ~1e-6 of the hatched area). The face entities carry the arcs exactly, so their
        // length is held tight.
        expect(faceLength(sw)).toBeCloseTo(faceLength(bw), 6);
        const area = Math.abs(hatchArea(bw));
        expect(Math.abs(Math.abs(hatchArea(sw)) - area)).toBeLessThanOrEqual(area * 1e-5);
        // And every split face LINE lies on a drawn one — it can only be a piece of it.
        const seg = (e: Ent): [number, number, number, number] => [
          groupNum(e, 10),
          groupNum(e, 20),
          groupNum(e, 11),
          groupNum(e, 21),
        ];
        const on = (px: number, py: number, [ax, ay, bx, by]: [number, number, number, number]): boolean => {
          const dx = bx - ax;
          const dy = by - ay;
          const len = Math.hypot(dx, dy);
          const t = ((px - ax) * dx + (py - ay) * dy) / (len * len);
          return Math.abs((px - ax) * dy - (py - ay) * dx) / len < 1e-3 && t > -1e-9 && t < 1 + 1e-9;
        };
        const drawn = bw.filter((e) => e.type === "LINE").map(seg);
        for (const e of sw.filter((x) => x.type === "LINE")) {
          const [ax, ay, bx, by] = seg(e);
          expect(drawn.some((d) => on(ax, ay, d) && on(bx, by, d))).toBe(true);
        }
      }
    });
  }
});
