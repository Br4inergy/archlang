/**
 * Q8/RF3 evidence: does the pure-TypeScript `straight-skeleton@1.1.0` (MIT) hold up on the roof rings the core produces?
 * (v3.x wraps CGAL's GPL-3.0+ straight skeleton through WebAssembly, so it is excluded by licence, not tested.)
 * Usage: tsx skeleton_eval.mts <core-root> <dir-containing-node_modules/straight-skeleton>   (cwd = that dir)
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
const root = path.resolve(process.argv[2]!);
const req = createRequire(path.join(path.resolve(process.argv[3] ?? "."), "x.js"));
const SK = req("straight-skeleton");
const SkeletonBuilder = SK.SkeletonBuilder;
const src = (p: string) => import(pathToFileURL(path.join(root, "src", p)).href);
const { resolvePlan } = await src("analyze.ts");
const { makeVirtualWorld } = await src("world.ts");
type P = [number, number];
const area = (r: P[]) => {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i]!,
      b = r[(i + 1) % r.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
};
function run(name: string, outer: P[], holes: P[][] = []) {
  const ccw = (r: P[]) => (area(r) > 0 ? r : [...r].reverse());
  const cw = (r: P[]) => (area(r) < 0 ? r : [...r].reverse());
  const rings = [ccw(outer), ...holes.map(cw)];
  const t0 = performance.now();
  try {
    const sk = SkeletonBuilder.BuildFromGeoJSON([rings]);
    const ms = performance.now() - t0;
    const faces = sk.Edges.length;
    let faceArea = 0,
      bad = 0;
    for (const e of sk.Edges) {
      const a = Math.abs(area(e.Polygon.map((p: any) => [p.X ?? p.x, p.Y ?? p.y] as P)));
      faceArea += a;
      if (!(a > 0)) bad++;
    }
    const total = Math.abs(area(outer)) - holes.reduce((s, h) => s + Math.abs(area(h)), 0);
    let maxH = 0;
    for (const [, d] of sk.Distances) maxH = Math.max(maxH, d);
    return {
      name,
      ok: true,
      verts: outer.length,
      faces,
      areaErr: +(Math.abs(faceArea - total) / total).toExponential(1),
      degenerateFaces: bad,
      maxHeight_mm: +maxH.toFixed(0),
      ms: +ms.toFixed(1),
    };
  } catch (e: any) {
    return { name, ok: false, verts: outer.length, error: String(e?.message ?? e).slice(0, 80) };
  }
}
const out: any[] = [];
out.push(
  run("rect 10x6 m", [
    [0, 0],
    [10000, 0],
    [10000, 6000],
    [0, 6000],
  ]),
);
out.push(
  run("L-shape", [
    [0, 0],
    [10000, 0],
    [10000, 4000],
    [5000, 4000],
    [5000, 8000],
    [0, 8000],
  ]),
);
out.push(
  run("U-shape", [
    [0, 0],
    [9000, 0],
    [9000, 8000],
    [6000, 8000],
    [6000, 3000],
    [3000, 3000],
    [3000, 8000],
    [0, 8000],
  ]),
);
out.push(
  run("T-shape", [
    [0, 0],
    [12000, 0],
    [12000, 3000],
    [8000, 3000],
    [8000, 9000],
    [4000, 9000],
    [4000, 3000],
    [0, 3000],
  ]),
);
out.push(
  run(
    "rect + courtyard hole",
    [
      [0, 0],
      [12000, 0],
      [12000, 10000],
      [0, 10000],
    ],
    [
      [
        [4000, 3000],
        [8000, 3000],
        [8000, 7000],
        [4000, 7000],
      ],
    ],
  ),
);
out.push(
  run("rect with collinear midpoints", [
    [0, 0],
    [5000, 0],
    [10000, 0],
    [10000, 3000],
    [10000, 6000],
    [0, 6000],
  ]),
);
out.push(
  run(
    "regular 48-gon r=6 m (tessellated circle)",
    Array.from(
      { length: 48 },
      (_, i) => [6000 * Math.cos((2 * Math.PI * i) / 48), 6000 * Math.sin((2 * Math.PI * i) / 48)] as P,
    ),
  ),
);
out.push(
  run("thin sliver 10x0.2 m", [
    [0, 0],
    [10000, 0],
    [10000, 200],
    [0, 200],
  ]),
);
out.push(
  run("non-axis hexagon (3-4-5)", [
    [16000, 7000],
    [11500, 1000],
    [5500, 1000],
    [1000, 7000],
    [5500, 13000],
    [11500, 13000],
  ]),
);
// the roof outlines the core actually produces
const exDir = path.join(root, "examples");
const files: Record<string, string> = {};
for (const f of readdirSync(path.join(exDir, "lib")))
  files["lib/" + f] = readFileSync(path.join(exDir, "lib", f), "utf8");
for (const f of readdirSync(exDir).filter((x) => x.endsWith(".arch")))
  files[f] = readFileSync(path.join(exDir, f), "utf8");
const world = makeVirtualWorld(files);
let roofs = 0;
for (const f of Object.keys(files)
  .filter((k) => k.endsWith(".arch") && !k.startsWith("lib/"))
  .sort()) {
  const r = resolvePlan(files[f]!, { world });
  if (!r.ir) continue;
  const storeys = r.levels.length ? r.levels.map((l: any) => l.ir) : [r.ir];
  storeys.forEach((ir: any, si: number) => {
    ir.elements
      .filter((e: any) => e.kind === "roof")
      .forEach((e: any, k: number) => {
        roofs++;
        out.push(
          run(
            `core roof ring: ${f} L${si} #${k}`,
            e.ring.map((p: any) => [p.x, p.y] as P),
          ),
        );
      });
  });
}
const ok = out.filter((r) => r.ok).length;
const roofRows = out.filter((r) => r.name.startsWith("core roof"));
console.log(
  JSON.stringify(
    { cases: out.length, ok, coreRoofRings: roofs, coreRoofOk: roofRows.filter((r) => r.ok).length, rows: out },
    null,
    1,
  ),
);
