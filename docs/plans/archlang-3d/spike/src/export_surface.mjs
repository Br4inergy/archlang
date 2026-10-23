// List the names exported from a core checkout's src/index.ts, plus where and how the symbols that the
// downstream 3D package needs are declared. Run it on two checkouts and diff the JSON to see how the
// export surface moved between two core commits.
// Usage: node export_surface.mjs <core-repo-root> [out.json]
// The core's own TypeScript is used, so run `npm ci` in the checkout first.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const outFile = process.argv[3];
const ts = createRequire(path.join(root, "package.json"))("typescript");
const cfg = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, root);
const rootNames = [
  "src/index.ts",
  "src/analyze.ts",
  "src/wall-lowering.ts",
  "src/geometry.ts",
  "src/geometry/joinery.ts",
].map((f) => path.join(root, f));
const program = ts.createProgram({ rootNames, options: { ...parsed.options, noEmit: true } });
const checker = program.getTypeChecker();
const indexFile = program.getSourceFile(path.join(root, "src/index.ts"));
const indexSymbol = checker.getSymbolAtLocation(indexFile);

const exportNames = checker
  .getExportsOfModule(indexSymbol)
  .map((s) => s.name)
  .sort();

function declaredAt(file, name) {
  const sf = program.getSourceFile(path.join(root, file));
  if (!sf) return { file, found: false };
  const moduleSymbol = checker.getSymbolAtLocation(sf);
  const sym = moduleSymbol ? checker.getExportsOfModule(moduleSymbol).find((s) => s.name === name) : undefined;
  if (!sym?.declarations?.length) return { file, found: false };
  const decl = sym.declarations[0];
  const pos = sf.getLineAndCharacterOfPosition(decl.getStart());
  const text = decl.getText(sf).replace(/\s+/g, " ");
  return {
    file,
    found: true,
    line: pos.line + 1,
    kind: ts.SyntaxKind[decl.kind],
    exportedFromIndex: exportNames.includes(name),
    text: text.length > 400 ? `${text.slice(0, 400)}...` : text,
  };
}

const symbols = [
  ["src/analyze.ts", "resolvePlan"],
  ["src/analyze.ts", "AnalyzeOptions"],
  ["src/wall-lowering.ts", "joinWallSet"],
  ["src/geometry/joinery.ts", "loopsToPolygons"],
  ["src/geometry.ts", "doorSwing"],
  ["src/geometry.ts", "DoorLike"],
  ["src/geometry.ts", "DoorSwing"],
  ["src/geometry/joinery.ts", "JoinerySplit"],
  ["src/wall-lowering.ts", "JoinedWallSet"],
  ["src/wall-lowering.ts", "JoinedCut"],
];
const declarations = {};
symbols.forEach(([file, name]) => {
  declarations[name] = declaredAt(file, name);
});

const result = { exportCount: exportNames.length, exportNames, declarations };
if (outFile) writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`);
console.log("index.ts export count:", exportNames.length);
Object.entries(declarations).forEach(([name, d]) => {
  console.log(name, d.found ? `${d.file}:${d.line} exported=${d.exportedFromIndex}` : "NOT FOUND");
});
