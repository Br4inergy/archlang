// Compute the type closure of candidate C1/C2 exports and report which named types
// are NOT yet exported from src/index.ts. Usage: node export_closure.mjs <core-repo-root>
import path from "node:path";
import { createRequire } from "node:module";
const root = path.resolve(process.argv[2] ?? ".");
const ts = createRequire(path.join(root, "package.json"))("typescript"); // the core's own TypeScript
const cfg = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, root);
const program = ts.createProgram({
  rootNames: [
    path.join(root, "src/index.ts"),
    path.join(root, "src/wall-lowering.ts"),
    path.join(root, "src/geometry.ts"),
    path.join(root, "src/geometry/joinery.ts"),
  ],
  options: { ...parsed.options, noEmit: true },
});
const checker = program.getTypeChecker();
const indexSf = program.getSourceFile(path.join(root, "src/index.ts"));
const _exported = new Set(
  checker.getExportsOfModule(checker.getSymbolAtLocation(indexSf)).map((s) => {
    const t = s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s;
    return t.declarations?.[0] ? declKey(t) : s.name;
  }),
);
function declKey(sym) {
  const d = sym.declarations[0];
  return `${path.relative(root, d.getSourceFile().fileName)}#${sym.name}`;
}
const exportedNames = new Set(checker.getExportsOfModule(checker.getSymbolAtLocation(indexSf)).map((s) => s.name));
function symOfExport(file, name) {
  const sf = program.getSourceFile(path.join(root, file));
  const m = checker.getSymbolAtLocation(sf);
  return checker.getExportsOfModule(m).find((s) => s.name === name);
}
const seen = new Map(); // key -> {name,file}
function visitType(t, depth = 0) {
  if (!t) return;
  const sym = t.aliasSymbol ?? t.getSymbol?.();
  if (sym?.declarations?.length) {
    const d = sym.declarations[0];
    const f = path.relative(root, d.getSourceFile().fileName);
    if (
      f.startsWith("src/") &&
      sym.name !== "__type" &&
      sym.name !== "__object" &&
      !/^(Array|Map|Set|Record|Pick|Omit|Partial|Readonly)$/.test(sym.name)
    ) {
      const key = `${f}#${sym.name}`;
      if (seen.has(key)) return;
      seen.set(key, { name: sym.name, file: f });
      for (const p of checker.getPropertiesOfType(t)) visitType(checker.getTypeOfSymbolAtLocation(p, d), depth + 1);
      return;
    }
  }
  if (t.isUnionOrIntersection?.())
    t.types.forEach((x) => {
      visitType(x, depth + 1);
    });
  else if (t.typeArguments || t.resolvedTypeArguments)
    (checker.getTypeArguments?.(t) ?? []).forEach((x) => {
      visitType(x, depth + 1);
    });
  else if (t.flags & ts.TypeFlags.Object)
    for (const p of checker.getPropertiesOfType(t))
      visitType(checker.getTypeOfSymbolAtLocation(p, p.declarations?.[0] ?? indexSf), depth + 1);
}
const entries = [
  ["src/wall-lowering.ts", "joinWallSet"],
  ["src/geometry/joinery.ts", "loopsToPolygons"],
  ["src/geometry.ts", "doorSwing"],
  ["src/wall-lowering.ts", "JoinedWallSet"],
  ["src/geometry/joinery.ts", "JoineryResult"],
];
const report = {};
for (const [file, name] of entries) {
  seen.clear();
  const s = symOfExport(file, name);
  if (!s) {
    report[name] = "NOT FOUND";
    continue;
  }
  const d = s.declarations[0];
  if (ts.isFunctionDeclaration(d)) {
    const sig = checker.getSignatureFromDeclaration(d);
    for (const p of sig.parameters) visitType(checker.getTypeOfSymbolAtLocation(p, d));
    visitType(checker.getReturnTypeOfSignature(sig));
  } else visitType(checker.getDeclaredTypeOfSymbol(s));
  report[name] = [...seen.values()]
    .map((v) => ({ ...v, exportedFromIndex: exportedNames.has(v.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
const all = new Map();
for (const [_fn, list] of Object.entries(report)) if (Array.isArray(list)) for (const v of list) all.set(v.name, v);
console.log("index.ts export count:", exportedNames.size);
console.log(
  "function-level exported already?",
  Object.fromEntries(
    [
      "joinWallSet",
      "loopsToPolygons",
      "doorSwing",
      "DoorLike",
      "DoorSwing",
      "DoorSwingDir",
      "DoorHinge",
      "JoinedWallSet",
      "JoineryResult",
      "EdgeLoop",
      "Edge",
      "Arc",
      "WallSegment",
      "Opening",
      "RWall",
      "RDoor",
      "ResolvedPlan",
      "PlanResolution",
      "ResolvedLevel",
      "RStair",
      "RRoof",
      "RVoid",
      "RColumn",
      "RFurniture",
      "RRoom",
      "RWindow",
      "ROpening",
      "RElevator",
      "REscalator",
      "ROutdoor",
      "RFence",
      "resolvePlan",
      "parse",
      "link",
      "Point",
      "DoorKind",
    ].map((n) => [n, exportedNames.has(n)]),
  ),
);
const missing = [...all.values()].filter((v) => !v.exportedFromIndex);
console.log("closure types:", all.size, "not exported:", missing.length);
for (const m of missing) console.log("  MISSING", m.name, m.file);
