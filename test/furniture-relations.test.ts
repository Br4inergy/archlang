/**
 * Furniture relations (ADR 0029, plan-soundness card PS3.7): `facing <id>`,
 * `against <room>.<edge>` and `clear front|sides <mm>`.
 *
 * - **Swap-back twins.** Each form is pinned against the hand-written plan it stands for:
 *   `facing t` draws and lints as the `rotate` it derives; `against r.left` as its
 *   `against wall … side …` twin; a `clear` declaration draws exactly what the plan without it
 *   draws, and its facts differ only by the `clear` key.
 * - **Frames.** The derived turn is equivariant: under all eight `place` frames the instance's
 *   turn is the one whose front ray, measured in PLAN space, enters the target.
 * - **Refusals.** Every code is raised, spanned on the clause at fault.
 * - **Budget.** `facing` charges `1 + |group| + 4` steps before it reads anything.
 */

import { describe as suite, expect, it } from "vitest";
import { compile, describe as describePlan, lint, planJsonToArch, planToJson } from "../src/index.js";
import { furniture as furnitureDef } from "../src/elements/furniture.js";
import { MAX_EVAL_STEPS, withStepMeter } from "../src/expr.js";
import { facingTurn, frontRayHit } from "../src/furniture-relation.js";
import { link } from "../src/import.js";
import { evaluationSteps, type RFurniture, resolveAll } from "../src/ir.js";
import { parse } from "../src/parser.js";
import { BUILTIN_REGISTRY } from "../src/registry.js";
import { NULL_WORLD } from "../src/world.js";

const plan = (body: string): string => `plan "R" {\n  units mm\n  grid 50\n${body}\n}\n`;
const ROOMS = `  room id=r at (0,0) size 5000x4000 uses living
  wall id=w exterior thickness 200 { (0,0) (5000,0) (5000,4000) (0,4000) close }`;

type Summary = { furniture: Record<string, unknown>[]; freedom: Record<string, unknown> };
const facts = (src: string): Summary => describePlan(src) as unknown as Summary;
const svg = (src: string): string => {
  const out = compile(src, { noCache: true });
  expect(out.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  return out.svg;
};
const codes = (src: string): string[] => compile(src, { noCache: true }).diagnostics.map((d) => d.code ?? "?");

/** The resolved furniture of a source, in plan space. */
function pieces(src: string): RFurniture[] {
  const { plan: ast } = parse(src, BUILTIN_REGISTRY);
  const linked = link(ast!, NULL_WORLD, BUILTIN_REGISTRY);
  return resolveAll(linked.plan, BUILTIN_REGISTRY, NULL_WORLD).ir.elements.filter(
    (e): e is RFurniture => e.kind === "furniture",
  );
}

function stepsOf(src: string): number {
  const { plan: ast } = parse(src, BUILTIN_REGISTRY);
  const linked = link(ast!, NULL_WORLD, BUILTIN_REGISTRY);
  return evaluationSteps(resolveAll(linked.plan, BUILTIN_REGISTRY, NULL_WORLD));
}

/** Drop one key from every furniture row (and nothing else). */
function withoutKey(s: Summary, key: string): Summary {
  return { ...s, furniture: s.furniture.map(({ [key]: _, ...rest }) => rest) };
}

suite("facing — the derived turn", () => {
  // A table, and a chair on each of its four sides: each must turn to face it.
  const around = (clause: (i: number) => string) =>
    plan(`${ROOMS}
  furniture id=t dining_table at (2000,1500) size 900x900
  furniture id=n chair at (2225,950) size 450x450${clause(0)}
  furniture id=s chair at (2225,2500) size 450x450${clause(1)}
  furniture id=wst chair at (1450,1725) size 450x450${clause(2)}
  furniture id=e chair at (3000,1725) size 450x450${clause(3)}`);
  const TURNS = [0, 180, 270, 90];

  it("turns each chair to the table it is sat at (front ray, rotate 0 = back to the north)", () => {
    const got = pieces(around(() => " facing t")).filter((f) => f.category === "chair");
    expect(got.map((f) => f.rotate ?? 0)).toEqual(TURNS);
  });

  it("swap-back: `facing t` draws and lints as the `rotate` it resolves to; describe differs only by `facing`", () => {
    const declared = around(() => " facing t");
    const twin = around((i) => (TURNS[i] ? ` rotate ${TURNS[i]}` : ""));
    expect(svg(declared)).toBe(svg(twin));
    expect(lint(declared)).toEqual(lint(twin));
    expect(withoutKey(facts(declared), "facing")).toEqual(facts(twin));
    expect(facts(declared).furniture.filter((f) => f.facing === "t")).toHaveLength(4);
  });

  it("a target may come later in the source, and two pieces may face each other", () => {
    const src = plan(`${ROOMS}
  furniture id=sofa sofa at (1400,2900) size 2200x900 facing tv
  furniture id=tv tv_unit at (1750,300) size 1500x450 facing sofa`);
    const [sofa, tv] = pieces(src);
    expect(codes(src)).toEqual([]);
    expect(sofa!.rotate).toBe(180);
    expect(tv!.rotate ?? 0).toBe(0);
  });

  it("faces a rectangular room and an opening's body", () => {
    const src = plan(`${ROOMS}
  room id=hall at (5000,0) size 2000x4000 uses hall
  door id=d on w at 2500 width 900
  furniture id=desk desk at (2000,1000) size 1200x600 facing d
  furniture id=b bench at (5100,1500) size 450x1200 facing r`);
    expect(codes(src)).toEqual([]);
    const [desk, bench] = pieces(src);
    // The door is on the top run at x 2500: the desk's front turns north.
    expect(desk!.rotate).toBe(180);
    // The bench stands in the hall, east of the room: its front turns west.
    expect(bench!.rotate).toBe(90);
  });

  it("replaces an anchored piece's derived turn", () => {
    const src = plan(`${ROOMS}
  furniture id=t table at (2000,2500) size 900x900
  furniture id=b bed in r anchor top flush size 1500x2000 facing t`);
    // Anchored at the top wall, `bed` would derive rotate 0; facing the table south is also 0,
    // so pin the other way round: a table north of a bottom-anchored bed.
    const other = plan(`${ROOMS}
  furniture id=t table at (2000,300) size 900x900
  furniture id=b bed in r anchor bottom flush size 1500x2000 facing t`);
    expect(codes(src)).toEqual([]);
    expect(pieces(other).find((f) => f.id === "b")!.rotate).toBe(180);
  });
});

suite("facing — refusals, each spanned on the clause", () => {
  const T = `${ROOMS}\n  furniture id=t table at (2000,1500) size 900x900`;
  const cases: Array<[string, string, string]> = [
    ["E_FACING_TARGET", `${T}\n  furniture chair at (0,0) size 450x450 facing nowhere`, "facing nowhere"],
    ["E_FACING_TARGET", `${T}\n  furniture id=c chair at (300,300) size 450x450 facing c`, "facing c"],
    ["E_FACING_TARGET", `${T}\n  furniture chair at (300,300) size 450x450 facing w`, "facing w"],
    [
      "E_FACING_TARGET",
      `${T}\n  room id=p polygon (6000,0) (8000,0) (8000,2000) (7000,2000) (7000,3000) (6000,3000)\n  furniture chair at (300,300) size 450x450 facing p`,
      "facing p",
    ],
    ["E_FACING_MISS", `${T}\n  furniture chair at (300,300) size 450x450 facing t`, "facing t"],
    ["E_FACING_TIE", `${T}\n  furniture chair at (2225,1725) size 450x450 facing t`, "facing t"],
    ["E_FACING_CONFLICT", `${T}\n  furniture chair at (2225,2500) size 450x450 rotate 180 facing t`, "facing t"],
    ["E_FACING_CONFLICT", `${T}\n  furniture wardrobe against r.left facing t`, "facing t"],
    [
      "E_FACING_SYMMETRIC",
      `${T}\n  furniture id=c chair at (300,300) size 450x450\n  furniture table at (0,900) size 800x800 facing c`,
      "facing c",
    ],
    [
      "E_FACING_TRANSPOSED",
      `${T}\n  furniture id=b bed at (300,300) size 1500x2000\n  furniture tv_unit at (2500,1000) size 1500x450 facing b`,
      "facing b",
    ],
  ];
  for (const [code, body, clause] of cases)
    it(`${code}: ${clause} (${body.split("\n").pop()!.trim()})`, () => {
      const src = plan(body);
      const ds = compile(src, { noCache: true }).diagnostics.filter((d) => d.code === code);
      expect(ds).toHaveLength(1);
      const span = ds[0]!.span!;
      expect(src.slice(span.start, span.end)).toBe(clause);
    });

  it("a refused piece keeps no turn", () => {
    const f = pieces(plan(`${T}\n  furniture id=c chair at (300,300) size 450x450 facing t`)).find(
      (p) => p.id === "c",
    )!;
    expect(f.rotate).toBeUndefined();
  });
});

suite("facing — frames: the instance's derived turn is the plan-space answer", () => {
  const component = `  component c() {
    room id=r at (0,0) size 5000x4000 uses living
    furniture id=t dining_table at (2000,1500) size 900x900
    furniture id=e chair at (3000,1725) size 450x450 facing t
    furniture id=n chair at (2225,950) size 450x450 facing t
  }`;
  const frames: Array<[number, "" | "x" | "y"]> = [];
  for (const r of [0, 90, 180, 270]) for (const m of ["", "x"] as const) frames.push([r, m]);
  for (const [rot, mirror] of frames)
    it(`place … rotate ${rot}${mirror ? ` mirror ${mirror}` : ""}`, () => {
      const src = plan(
        `${component}\n  place c() as a at (10000,10000)${rot ? ` rotate ${rot}` : ""}${mirror ? ` mirror ${mirror}` : ""}`,
      );
      expect(codes(src)).toEqual([]);
      const all = pieces(src);
      const t = all.find((f) => f.id === "a.t")!;
      const rect = (f: RFurniture) => ({ x: f.at.x, y: f.at.y, w: f.size.w, h: f.size.h });
      for (const id of ["a.e", "a.n"]) {
        const f = all.find((p) => p.id === id)!;
        // Equivariance: what `facing` derives in the component's frame, carried by the frame, is
        // what it derives on the plan-space footprints. The output is a D4 turn, never a new one.
        const res = facingTurn(rect(f), rect(t));
        expect(res.kind).toBe("turn");
        expect(f.rotate ?? 0).toBe(res.kind === "turn" ? res.turn : -1);
        expect(frontRayHit(rect(f), f.rotate ?? 0, rect(t))).not.toBeNull();
        expect([0, 90, 180, 270]).toContain(f.rotate ?? 0);
        expect(f._facing).toBe("a.t");
      }
    });

  it("a mirrored instance draws the mirror of its facing twin's drawing (no glyph gains handedness)", () => {
    // The chair glyph has a vertical mirror axis, so a mirrored instance draws, byte for byte,
    // what the explicit-rotate twin draws under the same frame.
    const twin = component
      .replace("size 450x450 facing t\n    furniture id=n", "size 450x450 rotate 90\n    furniture id=n")
      .replace("(2225,950) size 450x450 facing t", "(2225,950) size 450x450");
    for (const m of ["x", "y"]) {
      const a = plan(`${component}\n  place c() as a at (10000,10000) mirror ${m}`);
      const b = plan(`${twin}\n  place c() as a at (10000,10000) mirror ${m}`);
      expect(svg(a)).toBe(svg(b));
    }
  });
});

suite("against <room>.<edge> (ADR 0028 §5a)", () => {
  it("swap-back: draws and lints as its `against wall … side …` twin; describe differs only by relation", () => {
    const edge = plan(`${ROOMS}\n  furniture id=f wardrobe against r.left offset 2000`);
    const wall = plan(`${ROOMS}\n  furniture id=f wardrobe against wall w segment 3 offset 2000 side left in r`);
    expect(svg(edge)).toBe(svg(wall));
    expect(lint(edge)).toEqual(lint(wall));
    const e = facts(edge);
    const w = facts(wall);
    expect(withoutKey(e, "relation").furniture).toEqual(w.furniture);
    expect(e.furniture[0]!.relation).toBe("against r.left offset 2000");
    expect((e.freedom.furniture as Record<string, number>).relational).toBe(1);
  });

  it("backs onto a derived wall, which has no id", () => {
    const src = plan(`  room id=a at (0,0) size 4000x4000 uses bedroom
  room id=b right-of a size 3000x4000 uses living
  walls from rooms exterior 200 partition 100 { }
  furniture id=f wardrobe against a.right`);
    expect(codes(src)).toEqual([]);
    const f = pieces(src)[0]!;
    // The partition between a and b stands on x 4000, 100 thick: the back is on its face at 3950.
    expect(f.at.x + f.size.w).toBe(3950);
    expect(f.rotate).toBe(90);
  });

  it("with no wall on the edge, the back lies on the edge line", () => {
    const f = pieces(plan(`  room id=r at (0,0) size 5000x4000\n  furniture bed against r.bottom`))[0]!;
    expect(f.at.y + f.size.h).toBe(4000);
    expect(f.rotate).toBe(180);
  });

  const refused: Array<[string, string]> = [
    ["not a room edge", `${ROOMS}\n  furniture wardrobe against r.cx`],
    ["offset off the edge", `${ROOMS}\n  furniture wardrobe against r.top offset 6000`],
    [
      "another room's `in`",
      `${ROOMS}\n  room id=q at (6000,0) size 1000x1000\n  furniture wardrobe against r.top in q`,
    ],
    ["`rotate`", `${ROOMS}\n  furniture wardrobe against r.top rotate 90`],
    [
      "a wall beside the line",
      `  room id=r at (0,0) size 5000x4000\n  wall exterior thickness 200 { (0,50) (5000,50) }\n  furniture wardrobe against r.top`,
    ],
    [
      "a part-covered span",
      `  room id=r at (0,0) size 5000x4000\n  wall exterior thickness 200 { (0,0) (2600,0) }\n  furniture wardrobe against r.top`,
    ],
    [
      "two thicknesses",
      `  room id=r at (0,0) size 5000x4000\n  wall exterior thickness 200 { (0,0) (2500,0) }\n  wall exterior thickness 100 { (2500,0) (5000,0) }\n  furniture wardrobe against r.top`,
    ],
    [
      "a run declared open",
      `  room id=a at (0,0) size 4000x4000\n  room id=b right-of a size 3000x4000\n  walls from rooms exterior 200 partition 100 { open between a and b }\n  furniture wardrobe against a.right`,
    ],
  ];
  for (const [why, body] of refused)
    it(`E_FURN_AGAINST: ${why}`, () => {
      const src = plan(body);
      const ds = compile(src, { noCache: true }).diagnostics.filter((d) => d.code === "E_FURN_AGAINST");
      expect(ds).toHaveLength(1);
    });

  it("a door in the backing wall does not refuse it (lint's business)", () => {
    expect(codes(plan(`${ROOMS}\n  door on w at 2500 width 900\n  furniture wardrobe against r.top`))).toEqual([]);
  });

  it("a polygon room is E_ROOM_NOT_RECTANGLE, through the datum reader", () => {
    const src = plan(
      `  room id=p polygon (0,0) (4000,0) (4000,2000) (2000,2000) (2000,4000) (0,4000)\n  furniture wardrobe against p.top`,
    );
    expect(codes(src)).toContain("E_ROOM_NOT_RECTANGLE");
  });
});

suite("clear front|sides — declared, measured, checked", () => {
  const base = (clause: string) =>
    plan(
      `${ROOMS}\n  furniture id=robe wardrobe against r.top offset 1500${clause}\n  furniture id=b bed at (600,1300) size 1500x2000`,
    );

  it("draws nothing: the declared plan draws what the plan without it draws", () => {
    expect(svg(base(" clear front 600"))).toBe(svg(base("")));
  });

  it("facts differ only by the `clear` key, and the measure reaches the bed", () => {
    const d = facts(base(" clear front 600"));
    expect(withoutKey(d, "clear")).toEqual(facts(base("")));
    // The robe's front is y 700 (100 + 600 deep); the bed starts at y 1300: 600 free.
    expect(d.furniture[0]!.clear).toEqual({ front: { declared: 600, measured: 600 } });
    expect(facts(base(" clear front 800")).furniture[0]!.clear).toEqual({ front: { declared: 800, measured: 600 } });
  });

  it("lint warns only when declared and short, naming the obstruction", () => {
    expect(lint(base(" clear front 600")).filter((d) => d.code === "W_FURN_CLEAR_FRONT")).toEqual([]);
    const ds = lint(base(" clear front 800")).filter((d) => d.code === "W_FURN_CLEAR_FRONT");
    expect(ds).toHaveLength(1);
    expect(ds[0]!.message).toBe(
      "The wardrobe in r needs 800 mm clear in front, but the bed leaves 600 mm (200 mm short).",
    );
    expect(ds[0]!.message).not.toContain('"robe"');
  });

  it("sides: both edges beside the back; a wall body and a door swing count", () => {
    const src = plan(
      `${ROOMS}\n  door on w at 1000 from start width 800\n  furniture id=b bed against r.top offset 1500 clear sides 600`,
    );
    // The bed spans x 750–2250 on the top wall; its left side is 550 from the west wall's face
    // (x 100 + 650 = 750); the door's swing (x 600–1400, into the room) reaches it first.
    const d = facts(src).furniture[0]!.clear as { sides: { measured: number } };
    expect(d.sides.measured).toBeLessThan(600);
    expect(lint(src).map((x) => x.code)).toContain("W_FURN_CLEAR_SIDES");
  });

  it("E_FURN_CLEAR: zero, negative or repeated", () => {
    for (const c of [" clear front 0", " clear sides -5", " clear front 600 clear front 500"])
      expect(codes(base(c))).toContain("E_FURN_CLEAR");
  });

  it("a declared `clear front` replaces the catalogue's W_FURN_CLEARANCE for that piece", () => {
    const stove = (c: string) =>
      plan(`${ROOMS}\n  furniture stove at (1000,100) size 600x600${c}\n  furniture sofa at (1000,900) size 2000x900`);
    expect(lint(stove("")).map((d) => d.code)).toContain("W_FURN_CLEARANCE");
    expect(lint(stove(" clear front 200")).map((d) => d.code)).not.toContain("W_FURN_CLEARANCE");
  });
});

suite("W_SEAT_FACING_AWAY (PS2.11, undeclared)", () => {
  const cafe = (chair: string) =>
    plan(`${ROOMS}\n  furniture id=t table at (2000,1500) size 900x900\n  furniture chair at ${chair}`);
  it("a chair south of its table facing south warns; turned, it does not", () => {
    const ds = lint(cafe("(2225,2400) size 450x450")).filter((d) => d.code === "W_SEAT_FACING_AWAY");
    expect(ds).toHaveLength(1);
    expect(ds[0]!.message).toBe("A chair in r faces away from the table beside it.");
    expect(ds[0]!.hints![0]).toBe('Add `facing t` to "chair_2" (it turns to `rotate 180`).');
    expect(ds[0]!.fixes).toBeUndefined();
    expect(lint(cafe("(2225,2400) size 450x450 rotate 180")).map((d) => d.code)).not.toContain("W_SEAT_FACING_AWAY");
    expect(lint(cafe("(2225,2400) size 450x450 facing t")).map((d) => d.code)).not.toContain("W_SEAT_FACING_AWAY");
  });
  it("a chair beyond the reach is not at the table", () => {
    expect(lint(cafe("(2225,3100) size 450x450")).map((d) => d.code)).not.toContain("W_SEAT_FACING_AWAY");
  });
  it("is off with `seatTableReachMm: null`", () => {
    const src = cafe("(2225,2400) size 450x450");
    expect(lint(src, { ruleset: { seatTableReachMm: null } }).map((d) => d.code)).not.toContain("W_SEAT_FACING_AWAY");
  });
});

suite("Plan JSON round trip", () => {
  it("re-emits against_edge, facing and clear, and the round trip draws the same plan", () => {
    const src = plan(`${ROOMS}
  furniture id=t dining_table at (2000,1500) size 900x900
  furniture id=c chair at (2250,2400) size 450x450 facing t
  furniture id=robe wardrobe against r.left offset 2000 clear front 600 clear sides 100`);
    const { json } = planToJson(src);
    const f = json!.furniture;
    expect(f.find((x) => x.id === "c")).toMatchObject({ facing: "t", rotate: 180 });
    expect(f.find((x) => x.id === "robe")).toMatchObject({
      against_edge: "r.left",
      offset: 2000,
      clear_front: 600,
      clear_sides: 100,
    });
    const back = planJsonToArch(json);
    expect(back.diagnostics).toEqual([]);
    expect(back.source).toContain("furniture id=c chair at (2250,2400) size 450x450 facing t");
    expect(back.source).toContain(
      "furniture id=robe wardrobe against r.left offset 2000 size 1800x600 clear front 600 clear sides 100",
    );
    expect(svg(back.source!)).toBe(svg(src));
  });
});

suite("budget — facing is charged before it reads anything", () => {
  it("costs exactly 1 + |group| + 4 steps over the same piece with no turn", () => {
    const body = (c: string) =>
      plan(
        `${ROOMS}\n  furniture id=t table at (2000,1500) size 900x900\n  furniture chair at (2225,2400) size 450x450${c}`,
      );
    // The group: room, wall, table, chair = 4 elements. (A `rotate 180` twin costs the one
    // step its expression evaluates in, so the plain piece is the honest baseline.)
    expect(stepsOf(body(" facing t")) - stepsOf(body(""))).toBe(1 + 4 + 4);
  });

  it("against <room>.<edge> charges its datum read and one step per wall and wall point", () => {
    const edge = stepsOf(plan(`${ROOMS}\n  furniture wardrobe against r.left offset 2000`));
    const at = stepsOf(plan(`${ROOMS}\n  furniture wardrobe at (100,1100) size 600x1800`));
    // A floor, not an exact count: the `at` twin evaluates four literals the `size`-less edge form
    // does not, so the edge form's own charges (its datum read, and one step per wall, per wall
    // point and one more before the scan) must outweigh them. The exact `facing` count is above.
    expect(edge).toBeGreaterThan(at);
  });

  it("past the budget the settle pass unwinds before it turns the piece", () => {
    const f = {
      kind: "furniture",
      id: "c",
      category: "chair",
      at: { x: 0, y: 1000 },
      size: { w: 450, h: 450 },
      _facing: "t",
    } as RFurniture;
    const t = {
      kind: "furniture",
      id: "t",
      category: "table",
      at: { x: 0, y: 0 },
      size: { w: 450, h: 900 },
    } as RFurniture;
    const run = withStepMeter(MAX_EVAL_STEPS - 3, () => furnitureDef.settle!(f, [t, f], () => {}));
    expect("signal" in run).toBe(true);
    expect(f.rotate).toBeUndefined();
    const ok = withStepMeter(0, () => furnitureDef.settle!(f, [t, f], () => {}));
    expect(ok.used).toBe(1 + 2 + 4);
    expect(f.rotate).toBe(180);
  });
});
