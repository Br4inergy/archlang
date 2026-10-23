// Why the unlinked route is wrong for plans with `import`: element counts through `resolvePlan(source, { world })`
// versus `compile().ast` -> `resolveAll`, next to what `describe()` reports. Evidence for the C1 behavioural test.
// Usage: tsx resolveplan_import_probe.mts <core-root>
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2] ?? ".");
const load = (p: string) => import(pathToFileURL(path.join(root, "src", p)).href);
const { resolvePlan } = await load("analyze.ts");
const { compile, describe, makeVirtualWorld, resolveAll } = await load("index.ts");

const exDir = path.join(root, "examples");
const files: Record<string, string> = {};
readdirSync(path.join(exDir, "lib")).forEach((f) => {
  files[`lib/${f}`] = readFileSync(path.join(exDir, "lib", f), "utf8");
});
readdirSync(exDir)
  .filter((f) => f.endsWith(".arch"))
  .forEach((f) => {
    files[f] = readFileSync(path.join(exDir, f), "utf8");
  });
const world = makeVirtualWorld(files);

type El = { kind: string };
const count = (els: El[] | undefined, kind: string) => (els ?? []).filter((e) => e.kind === kind).length;

const rows = ["imports", "museum-wings", "laneway-house"].map((name) => {
  const source = files[`${name}.arch`];
  const resolved = resolvePlan(source, { world });
  const unlinked = resolveAll(compile(source, { world }).ast);
  const facts = describe(source, { world });
  return {
    example: name,
    resolvePlan: { elements: resolved.ir?.elements.length, walls: resolved.ir?.walls.length },
    unlinkedResolveAll: { elements: unlinked.ir?.elements.length, walls: unlinked.ir?.walls.length },
    describe: { rooms: facts.rooms?.length, furniture: facts.furniture?.length },
    resolvePlanRoomElements: count(resolved.ir?.elements, "room"),
    resolvePlanFurnitureElements: count(resolved.ir?.elements, "furniture"),
  };
});
console.log(JSON.stringify(rows, null, 2));
