/**
 * Laws of the joinery's SPLIT mode (`joinWalls(…, faces)`, `JoinerySplit` in
 * `src/geometry/joinery.ts`) — what lets the DXF file exterior and interior walls on separate
 * layers without a second ownership authority.
 *
 * 1. **Inert.** Asking for a split changes neither the outline nor any fill: the drawing is
 *    the same with or without it.
 * 2. **The runs partition the outline.** Their total length is the outline's.
 * 3. **The (group, face) fills tile the group fill.** Their net areas sum to the group's,
 *    and at sample points no face claims a point twice, nor one the group fill lacks.
 * 4. **Exterior first in a same-group tie.** A face listed first wins every point a wall of
 *    the same thickness and group shares with it, whatever the statement order.
 *
 * Run over every storey of every shipped example and over the joinery fuzz generator
 * (`test/arbitrary-joinery.ts`, the same pinned seed convention as
 * `test/joinery-oracle.test.ts`). Every quantity is read off the exact `EdgeLoop`s — arcs
 * included — so there is no tessellation in the tolerances.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Point } from "../src/ast.js";
import { distPointToSegment } from "../src/geometry.js";
import { distPointToArc } from "../src/geometry/arc.js";
import type { Edge, EdgeLoop } from "../src/geometry/band.js";
import { loopArea, loopWinding } from "../src/geometry/band.js";
import type { JoineryResult, JoineryWall } from "../src/geometry/joinery.js";
import { joinWalls } from "../src/geometry/joinery.js";
import { hatchesUsed, hatchKey } from "../src/hatches.js";
import { compile } from "../src/index.js";
import type { SceneWall } from "../src/scene.js";
import { classifyWallSet, joinWallSet } from "../src/wall-lowering.js";
import type { World } from "../src/world.js";
import { angledWalls, rectilinearWalls, renderWalls } from "./arbitrary-joinery.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = 20261013;
const RUNS = Number(process.env.JOINERY_RUNS ?? 150);

const edgeLength = (e: Edge): number =>
  e.t === "arc" ? Math.abs(e.arc.r * e.arc.sweep) : Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
const totalLength = (loops: readonly EdgeLoop[]): number =>
  loops.reduce((s, l) => s + l.reduce((t, e) => t + edgeLength(e), 0), 0);
/** A region's net area: its loops are directed solid-on-the-right, so holes cancel. */
const netArea = (loops: readonly EdgeLoop[]): number => Math.abs(loops.reduce((s, l) => s + loopArea(l), 0));
const inside = (loops: readonly EdgeLoop[], p: Point): boolean =>
  loops.reduce((n, l) => n + loopWinding(l, p), 0) !== 0;
const edgeDist = (p: Point, e: Edge): number =>
  e.t === "arc" ? distPointToArc(p, e.arc) : distPointToSegment(p, e.a, e.b);
const close = (a: number, b: number, rel = 1e-9): boolean => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));

/** Laws 1–3 for one join; returns a failure message, or null. */
function splitLaws(
  walls: readonly JoineryWall[],
  cuts: Parameters<typeof joinWalls>[1],
  groups: string[],
  faces: string[],
): string | null {
  const plain = joinWalls(walls, cuts, groups);
  const withSplit: JoineryResult = joinWalls(walls, cuts, groups, faces);
  if (JSON.stringify(withSplit.outline) !== JSON.stringify(plain.outline)) return "split mode moved the outline";
  if (JSON.stringify(withSplit.fills) !== JSON.stringify(plain.fills)) return "split mode moved a fill";
  const split = withSplit.split!;
  const runs = split.faces.flatMap((f) => f.runs);
  if (!close(totalLength(runs), totalLength(plain.outline))) {
    return `runs ${totalLength(runs)} != outline ${totalLength(plain.outline)}`;
  }
  // Sample grid over the solid's box, skipping points within 1e-6 mm of any boundary.
  const all = [...plain.outline, ...split.fills.flatMap((f) => f.loops)].flat();
  if (all.length === 0) return null;
  const xs = all.flatMap((e) => (e.t === "arc" ? [e.arc.a.x, e.arc.b.x, e.arc.center.x] : [e.a.x, e.b.x]));
  const ys = all.flatMap((e) => (e.t === "arc" ? [e.arc.a.y, e.arc.b.y, e.arc.center.y] : [e.a.y, e.b.y]));
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const N = 41;
  for (const fill of plain.fills) {
    const parts = split.fills.filter((f) => f.group === fill.group);
    const sum = parts.reduce((s, f) => s + netArea(f.loops), 0);
    if (!close(sum, netArea(fill.loops), 1e-9))
      return `group ${fill.group}: faces' area ${sum} != ${netArea(fill.loops)}`;
    const edges = [...fill.loops, ...parts.flatMap((f) => f.loops)].flat();
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const p = { x: x0 + ((x1 - x0) * (i + 0.37)) / N, y: y0 + ((y1 - y0) * (j + 0.61)) / N };
        if (edges.some((e) => edgeDist(p, e) < 1e-6)) continue;
        const claims = parts.filter((f) => inside(f.loops, p)).length;
        const want = inside(fill.loops, p) ? 1 : 0;
        if (claims !== want) return `group ${fill.group}: ${claims} faces claim (${p.x}, ${p.y}), the fill ${want}`;
      }
    }
  }
  return null;
}

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

const EXAMPLES = readdirSync(join(__dirname, "..", "examples"))
  .filter((f) => f.endsWith(".arch"))
  .sort();

describe("joinery split mode — laws over every shipped example", () => {
  for (const f of EXAMPLES) {
    it(`${f}: inert, runs partition the outline, face fills tile each group`, () => {
      const r = compile(readFileSync(join(__dirname, "..", "examples", f), "utf8"), {
        noCache: true,
        world: examplesWorld,
      });
      const scenes = r.pages ? r.pages.map((p) => p.scene) : [r.scene!];
      for (const scene of scenes) {
        const walls: readonly SceneWall[] = scene.walls ?? [];
        if (walls.length === 0) continue;
        // Re-derive the joinery inputs the way `classifyWallSet` does, and check the laws there.
        const keys = hatchesUsed(walls).map(hatchKey);
        const joined = joinWallSet(walls, keys, {
          faceOf: (w) => (w.category === "exterior" ? "EXTR" : "INTR"),
          faces: ["EXTR", "INTR"],
        })!;
        const split = joined.result.split!;
        expect(split.faces.map((x) => x.face)).toEqual(["EXTR", "INTR"]);
        const plain = joinWallSet(walls, keys)!.result;
        expect(JSON.stringify(joined.result.outline)).toBe(JSON.stringify(plain.outline));
        expect(JSON.stringify(joined.result.fills)).toBe(JSON.stringify(plain.fills));
        const runs = split.faces.flatMap((x) => x.runs);
        expect(close(totalLength(runs), totalLength(plain.outline))).toBe(true);
        for (const fill of plain.fills) {
          const parts = split.fills.filter((x) => x.group === fill.group);
          const sum = parts.reduce((s, x) => s + netArea(x.loops), 0);
          expect(close(sum, netArea(fill.loops))).toBe(true);
        }
      }
    });
  }
});

describe("joinery split mode — laws over the fuzz generator", () => {
  const families = fc.oneof(rectilinearWalls, angledWalls);
  it("inert, runs partition the outline, (group, face) fills tile each group fill", () => {
    fc.assert(
      fc.property(families, fc.array(fc.boolean(), { minLength: 5, maxLength: 5 }), (specs, ext) => {
        const { walls, cuts, groups } = renderWalls(specs);
        const faced = walls.map((w, i) => ({ ...w, face: ext[i % ext.length] ? "EXTR" : "INTR" }));
        expect(splitLaws(faced, cuts, groups, ["EXTR", "INTR"])).toBeNull();
      }),
      { numRuns: RUNS, seed: SEED },
    );
  });
});

describe("joinery split mode — the face listed first wins a same-group tie", () => {
  // The reviewer's repro: an envelope and a 200 mm wall of the same thickness and material
  // whose category sorts before "exterior". Both statement orders.
  const shell = "wall id=shell exterior thickness 200 { (0,0) (5000,0) (5000,4000) (0,4000) close }";
  const core = "wall id=part core thickness 200 { (2500,0) (2500,4000) }";
  for (const [label, body] of [
    ["envelope first", `${shell}\n${core}`],
    ["core first", `${core}\n${shell}`],
  ] as const) {
    it(`${label}: the junction squares and every outer-face run are the envelope's`, () => {
      const scene = compile(`plan "C" { units mm\n${body} }`, { noCache: true }).scene!;
      const split = classifyWallSet(scene.walls!, (w) => (w.category === "exterior" ? "EXTR" : "INTR"), [
        "EXTR",
        "INTR",
      ])!;
      const fill = split.fills[0]!;
      const area = (pts: Point[][]): number =>
        Math.abs(
          pts.reduce((s, loop) => {
            let a = 0;
            for (let i = 0; i < loop.length; i++) {
              const p = loop[i]!;
              const q = loop[(i + 1) % loop.length]!;
              a += p.x * q.y - q.x * p.y;
            }
            return s + a / 2;
          }, 0),
        );
      // The ring band is 5200x4200 - 4800x3800; the core is the 200 x 3800 between the faces.
      expect(area(fill.byClass.find((c) => c.cls === "EXTR")!.region)).toBeCloseTo(5200 * 4200 - 4800 * 3800, 6);
      expect(area(fill.byClass.find((c) => c.cls === "INTR")!.region)).toBeCloseTo(200 * 3800, 6);
      // No INTR face run touches the envelope's outer face (x = -100 / 5100, y = -100 / 4100).
      const outer = (p: Point): boolean => p.x === -100 || p.x === 5100 || p.y === -100 || p.y === 4100;
      const intr = split.faces.find((f) => f.cls === "INTR")!.runs;
      for (const run of intr) {
        let from = run.start;
        for (const e of run.edges) {
          expect(outer(from) && outer(e.to)).toBe(false);
          from = e.to;
        }
      }
    });
  }

  it("a class the caller did not list is refused, not silently dropped", () => {
    const scene = compile(`plan "C" { units mm\n${shell}\n${core} }`, { noCache: true }).scene!;
    expect(() => classifyWallSet(scene.walls!, (w) => w.category, ["exterior"])).toThrow(RangeError);
  });
});
