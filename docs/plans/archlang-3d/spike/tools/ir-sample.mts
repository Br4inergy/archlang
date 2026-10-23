// Print the resolved-IR facts that Plan JSON drops (arcs, stairs, voids, roof ring, elevation, derived walls)
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = process.argv[2];
const api: any = await import(join(root, "src/index.ts"));
const show = (file: string) => {
  const c: any = api.compile(readFileSync(join(root, "examples", file), "utf8"), { noCache: true });
  const res: any = api.resolveAll(c.ast);
  const irs = res.levels.length ? res.levels.map((l: any) => l.ir) : [res.ir];
  for (const ir of irs) {
    const out: any = { file, level: ir.level, elevation: ir.elevation, storeyHeight: ir.storeyHeight };
    out.arcWalls = ir.walls
      .filter((w: any) => w.arcs?.some(Boolean))
      .map((w: any) => ({
        id: w.id,
        arcs: w.arcs.map((a: any) => a && { c: a.c ?? a.center, r: a.r ?? a.radius, keys: Object.keys(a) }),
      }))
      .slice(0, 1);
    out.stairs = ir.elements
      .filter((e: any) => e.kind === "stair")
      .map((e: any) => ({ id: e.id, at: e.at, size: e.size, dir: e.dir, width: e.width }));
    out.voids = ir.elements
      .filter((e: any) => e.kind === "void")
      .map((e: any) => ({ id: e.id, at: e.at, size: e.size }));
    out.roof = ir.elements.filter((e: any) => e.kind === "roof").map((e: any) => ({ id: e.id, ring: e.ring }));
    out.derivedWalls = ir.walls.filter((w: any) => w._derived).length;
    console.log(JSON.stringify(out));
  }
};
for (const f of process.argv.slice(3)) show(f);
