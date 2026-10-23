/** Per-stage timing of the core-side work the 3D layer adds: resolvePlan (parse+link+resolve), joinWallSet (per-wall ownership), earcut caps.
 *  Usage: tsx perf_budget.mts <core-root>   (median of 15 runs after 3 warm-ups; one Node process, one core)  */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
const root = path.resolve(process.argv[2]!);
const req = createRequire(path.join(root, "package.json"));
const _e = req("earcut");
const earcut = _e.default ?? _e;
const src = (p: string) => import(pathToFileURL(path.join(root, "src", p)).href);
const { resolvePlan } = await src("analyze.ts");
const { joinWallSet } = await src("wall-lowering.ts");
const { loopsToPolygons } = await src("geometry/joinery.ts");
const { hatchOf, hatchKey } = await src("hatches.ts");
const { makeVirtualWorld } = await src("world.ts");
const { clearResolveCache } = await src("ir.ts");
const { clearParseCache } = await src("parser.ts");
const { clearLexCache } = await src("lexer.ts");
const exDir = path.join(root, "examples");
const files: Record<string, string> = {};
for (const f of readdirSync(path.join(exDir, "lib")))
  files["lib/" + f] = readFileSync(path.join(exDir, "lib", f), "utf8");
for (const f of readdirSync(exDir).filter((x) => x.endsWith(".arch")))
  files[f] = readFileSync(path.join(exDir, f), "utf8");
const world = makeVirtualWorld(files);
const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
const rows: any[] = [];
for (const f of [
  "tiny-house.arch",
  "laneway-house.arch",
  "townhouse.arch",
  "hillside-villa.arch",
  "clinic.arch",
  "library.arch",
  "transit-hall.arch",
  "aquarium.arch",
]) {
  const tR: number[] = [],
    tJ: number[] = [],
    tE: number[] = [];
  let walls = 0,
    tris = 0;
  for (let i = 0; i < 18; i++) {
    clearResolveCache();
    clearParseCache();
    clearLexCache();
    let t = performance.now();
    const r = resolvePlan(files[f]!, { world });
    const a = performance.now() - t;
    if (!r.ir) break;
    const storeys = r.levels.length ? r.levels.map((l: any) => l.ir) : [r.ir];
    t = performance.now();
    const regs: any[] = [];
    for (const ir of storeys) {
      const ws = ir.walls.map((w: any) => ({ ...w, openings: [] }));
      const ids = [...new Set(ws.map((w: any) => w.id))] as string[];
      const j = joinWallSet(ws, [...new Set(ws.map((w: any) => hatchKey(hatchOf(w))))], {
        faceOf: (w: any) => w.id,
        faces: ids,
      });
      regs.push(j.result.split.fills.map((s: any) => loopsToPolygons(s.loops)));
      walls += i === 3 ? ws.length : 0;
    }
    const b = performance.now() - t;
    t = performance.now();
    let n = 0;
    for (const st of regs)
      for (const rings of st)
        for (const ring of rings) {
          if (ring.length < 3) continue;
          const flat: number[] = [];
          for (const p of ring) flat.push(p.x, p.y);
          n += earcut(flat, [], 2).length / 3;
        }
    const c = performance.now() - t;
    if (i >= 3) {
      tR.push(a);
      tJ.push(b);
      tE.push(c);
      tris = n;
    }
  }
  rows.push({
    plan: f,
    walls,
    resolve_ms: +med(tR).toFixed(1),
    joinOwnership_ms: +med(tJ).toFixed(1),
    capTriangulation_ms: +med(tE).toFixed(2),
    capTrianglesApprox: tris,
  });
}
console.log(JSON.stringify({ node: process.version, rows }, null, 1));
