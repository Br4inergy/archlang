/**
 * H1 experiment: can `joinWallSet` (core, @98a4156) hand back one solid region PER WALL?
 *
 * Mechanism under test: `joinWallSet(walls, groupKeys, { faceOf: w => w.id, faces: ids })`.
 * `JoinerySplit.fills[g, f]` is group g's fill restricted to face f, and the pairs tile the
 * group's fill without overlapping. With one "face" per wall id that is per-wall ownership.
 *
 * Usage (from a core checkout with src/):  tsx h1_wall_ownership.ts <core-root> [out.json]
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const root = path.resolve(process.argv[2] ?? ".");
const src = (p: string) => import(path.join(root, "src", p));
const { resolvePlan } = await src("analyze.ts");
const { joinWallSet } = await src("wall-lowering.ts");
const { loopsToPolygons } = await src("geometry/joinery.ts");
const { hatchOf, hatchKey } = await src("hatches.ts");
const { loopArea, wallBand, PointInterner, tessellateLoop } = await src("geometry/band.ts");
const { polygonArea } = await src("geometry/polygon.ts");
const { makeVirtualWorld } = await src("world.ts");

type Pt = { x: number; y: number };

const _absArea = (rings: Pt[][]) => rings.reduce((s, r) => s + polygonArea(r), 0);

const exDir = path.join(root, "examples");
const files: Record<string, string> = {};
for (const f of readdirSync(path.join(exDir, "lib")))
  files["lib/" + f] = readFileSync(path.join(exDir, "lib", f), "utf8");
const world = makeVirtualWorld(files);

function signedArea(r: Pt[]): number {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i]!,
      b = r[(i + 1) % r.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}
const signed = (loops: any[]) => loopsToPolygons(loops).reduce((s: number, r: Pt[]) => s + signedArea(r), 0);

/** mode "slots": openings cut as full-height slots (what the core's plan/axon view joins).
 *  mode "solid": openings stripped, so each wall's region is its own solid and the cuts are separate objects. */
function measure(walls0: any[], mode: "slots" | "solid") {
  const walls = mode === "solid" ? walls0.map((w) => ({ ...w, openings: [] })) : walls0;
  const ids = [...new Set(walls.map((w: any) => w.id))] as string[];
  const groups = [...new Set(walls.map((w: any) => hatchKey(hatchOf(w))))] as string[];
  const t0 = performance.now();
  const joined = joinWallSet(walls, groups, { faceOf: (w: any) => w.id, faces: ids });
  const ms = performance.now() - t0;
  if (!joined?.result.split) return null;
  const split = joined.result.split;
  const own = new Map<string, number>(),
    pieces = new Map<string, number>();
  let holes = 0;
  for (const sf of split.fills) {
    own.set(sf.face, (own.get(sf.face) ?? 0) + signed(sf.loops));
    const rings = loopsToPolygons(sf.loops);
    pieces.set(sf.face, (pieces.get(sf.face) ?? 0) + rings.filter((r: Pt[]) => signedArea(r) > 0).length);
    holes += rings.filter((r: Pt[]) => signedArea(r) < 0).length;
  }
  const totalFill = joined.result.fills.reduce((s: number, x: any) => s + signed(x.loops), 0);
  const totalOwned = [...own.values()].reduce((a, b) => a + b, 0);
  let empty = 0,
    multi = 0,
    overBand = 0,
    sumBand = 0;
  for (const w of walls) {
    const o = own.get(w.id) ?? 0;
    const bandA = wallBand(w, new PointInterner()).reduce(
      (s: number, l: any) => s + Math.abs(signedArea(tessellateLoop(l))),
      0,
    );
    sumBand += bandA;
    if (o < 1) empty++;
    if ((pieces.get(w.id) ?? 0) > 1) multi++;
    if (o > bandA * 1.001 + 1) overBand++;
  }
  return {
    ms,
    empty,
    multi,
    holes,
    overBand,
    totalFill,
    totalOwned,
    sumBand,
    tileErr: Math.abs(totalFill - totalOwned) / Math.max(1, totalFill),
    nCuts: joined.cuts.length,
  };
}

const rows: any[] = [];
for (const f of readdirSync(exDir)
  .filter((x) => x.endsWith(".arch"))
  .sort()) {
  const source = readFileSync(path.join(exDir, f), "utf8");
  const res = resolvePlan(source, { world });
  if (!res.ir) {
    rows.push({
      example: f,
      status: "no-ir",
      errors: res.diagnostics
        .filter((d: any) => d.severity === "error")
        .map((d: any) => d.code)
        .slice(0, 3),
    });
    continue;
  }
  const storeys = res.levels.length ? res.levels.map((l: any) => l.ir) : [res.ir];
  const acc: any = {
    example: f,
    status: "ok",
    storeys: storeys.length,
    walls: 0,
    openings: 0,
    wallsWithArcs: 0,
    arcWallsWithOpenings: 0,
    wallsWithAngled: 0,
    dupWallIds: 0,
    slots: { empty: 0, multi: 0, holes: 0, overBand: 0, tileErr: 0, ms: 0 },
    solid: { empty: 0, multi: 0, holes: 0, overBand: 0, tileErr: 0, ms: 0 },
    heightsPerStorey: [] as number[][],
  };
  for (const ir of storeys) {
    const walls = ir.walls;
    acc.walls += walls.length;
    acc.dupWallIds += walls.length - new Set(walls.map((w: any) => w.id)).size;
    acc.heightsPerStorey.push([...new Set(walls.map((w: any) => w.height))].sort((a: any, b: any) => a - b));
    for (const w of walls) {
      acc.openings += w.openings.length;
      if (w.arcs?.some(Boolean)) {
        acc.wallsWithArcs++;
        if (w.openings.length) acc.arcWallsWithOpenings++;
      }
      for (let i = 0; i + 1 < w.points.length; i++) {
        const dx = w.points[i + 1].x - w.points[i].x,
          dy = w.points[i + 1].y - w.points[i].y;
        if (dx !== 0 && dy !== 0 && !w.arcs?.[i]) {
          acc.wallsWithAngled++;
          break;
        }
      }
    }
    for (const mode of ["slots", "solid"] as const) {
      const m = measure(walls, mode);
      if (!m) continue;
      const a = acc[mode];
      a.empty += m.empty;
      a.multi += m.multi;
      a.holes += m.holes;
      a.overBand += m.overBand;
      a.tileErr = Math.max(a.tileErr, m.tileErr);
      a.ms += m.ms;
    }
  }
  rows.push(acc);
}
const out = process.argv[3];
if (out) writeFileSync(out, JSON.stringify(rows, null, 1));
console.table(
  rows.map((r) =>
    r.status === "ok"
      ? {
          ex: r.example,
          walls: r.walls,
          op: r.openings,
          arcW: r.wallsWithArcs,
          angW: r.wallsWithAngled,
          slotsMulti: r.slots.multi,
          solidMulti: r.solid.multi,
          solidEmpty: r.solid.empty,
          solidHoles: r.solid.holes,
          solidOverBand: r.solid.overBand,
          tileErr: +Math.max(r.slots.tileErr, r.solid.tileErr).toExponential(1),
          ms: +(r.slots.ms + r.solid.ms).toFixed(1),
          heights: r.heightsPerStorey.map((h: number[]) => h.join("/")).join(" | "),
        }
      : r,
  ),
);
