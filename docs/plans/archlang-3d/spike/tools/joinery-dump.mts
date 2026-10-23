// Ground truth: ArchLang's own wall joinery (ADR 0018) for each example storey -> polygons (mm), one JSON file per storey.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const root = process.argv[2];
const outDir = process.argv[3];
mkdirSync(outDir, { recursive: true });
const api: any = await import(join(root, "src/index.ts"));
const wl: any = await import(join(root, "src/wall-lowering.ts"));
const jn: any = await import(join(root, "src/geometry/joinery.ts"));
for (const f of readdirSync(join(root, "examples"))
  .filter((x) => x.endsWith(".arch"))
  .sort()) {
  const c: any = api.compile(readFileSync(join(root, "examples", f), "utf8"), { noCache: true });
  if (!c.ast || c.errors?.length) continue;
  const res: any = api.resolveAll(c.ast);
  const irs = res.levels.length ? res.levels.map((l: any) => l.ir) : [res.ir];
  irs.forEach((ir: any, i: number) => {
    const j = wl.joinWallSet(ir.walls, []);
    if (!j) return;
    const loops = jn.loopsToPolygons(j.result.outline);
    const name = f.replace(".arch", "") + (res.levels.length ? `.L${res.levels[i].level}` : "");
    writeFileSync(
      join(outDir, name + ".json"),
      JSON.stringify({ loops: loops.map((l: any[]) => l.map((p) => [p.x, p.y])) }),
    );
  });
}
