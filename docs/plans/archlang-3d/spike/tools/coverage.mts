// Coverage probe: for every example, resolve with the repo's own compiler (resolveAll) and
// count what a 3D builder needs vs what the public Plan JSON carries.
// run: npx tsx tools/coverage.ts <archlang-src-root> <examples-dir>
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const root = process.argv[2];
const dir = process.argv[3];
const api: any = await import(join(root, "src/index.ts"));
const rows: any[] = [];
for (const f of readdirSync(dir)
  .filter((x) => x.endsWith(".arch"))
  .sort()) {
  const src = readFileSync(join(dir, f), "utf8");
  const c: any = api.compile(src, { noCache: true });
  const row: any = { file: f, errors: c.errors?.length ?? 0 };
  if (!c.ast) {
    row.note = "no ast";
    rows.push(row);
    continue;
  }
  const res: any = api.resolveAll(c.ast);
  const irs: any[] = res.levels.length ? res.levels.map((l: any) => l.ir) : [res.ir];
  row.levels = irs.length;
  const k: Record<string, number> = {};
  let arcWalls = 0,
    derived = 0,
    polyRooms = 0,
    circRooms = 0,
    doorKinds = new Set<string>();
  const elev: number[] = [],
    sh: number[] = [];
  for (const ir of irs) {
    elev.push(ir.elevation);
    sh.push(ir.storeyHeight);
    for (const w of ir.walls) {
      if (w.arcs?.some(Boolean)) arcWalls++;
      if (w._derived) derived++;
      k.wallsAll = (k.wallsAll ?? 0) + 1;
    }
    for (const e of ir.elements) {
      k[e.kind] = (k[e.kind] ?? 0) + 1;

      if (e.kind === "room") {
        if (e.circle) circRooms++;
        else if (e.poly) polyRooms++;
      }
      if (e.kind === "door") doorKinds.add(e.doorKind ?? "hinged");
    }
  }
  Object.assign(row, {
    kinds: k,
    arcWalls,
    derivedWalls: derived,
    polyRooms,
    circRooms,
    doorKinds: [...doorKinds],
    elev,
    sh,
  });
  rows.push(row);
}
console.log(JSON.stringify(rows, null, 1));
