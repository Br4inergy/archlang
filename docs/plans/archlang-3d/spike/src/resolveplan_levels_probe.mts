// What `resolvePlan` returns for single- and multi-storey examples: `ir.level`, the `levels[]` entries and their keys.
// Evidence for ADR 0031's stability section (the semantics of `levels`). Usage: tsx resolveplan_levels_probe.mts <core-root>
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2] ?? ".");
const { resolvePlan } = await import(pathToFileURL(path.join(root, "src/analyze.ts")).href);
const rows = ["one-room", "two-storey", "townhouse", "hillside-villa", "garden-house"].map((name) => {
  const result = resolvePlan(readFileSync(path.join(root, "examples", `${name}.arch`), "utf8"));
  return {
    example: name,
    irLevel: result.ir?.level ?? null,
    levels: result.levels.map((l: { level: number; name?: string }) => `${l.level}:${l.name ?? ""}`),
    levelKeys: result.levels[0] ? Object.keys(result.levels[0]) : [],
  };
});
console.log(JSON.stringify(rows, null, 2));
