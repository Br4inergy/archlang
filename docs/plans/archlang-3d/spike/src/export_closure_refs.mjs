// The export closure of the C1 candidates, derived the way the core's test/public-surface.test.ts derives its
// list: breadth-first over TYPE REFERENCE nodes (and `import("...").X` type nodes), starting at the signature of
// each root (type parameters, parameters, return type; never the function body) and following every named
// type declared under src/. Unlike spike/src/export_closure.mjs it follows `W extends JoinableWall` constraints
// and aliases such as `Edge`, so its output is the list a contract test written that way would require.
// Usage: node export_closure_refs.mjs <core-repo-root> [out.json]
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const outFile = process.argv[3];
const ts = createRequire(path.join(root, "package.json"))("typescript");
const cfg = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, root);
const SRC = path.join(root, "src").replace(/\\/g, "/");
const rootFiles = [
  "src/index.ts",
  "src/analyze.ts",
  "src/wall-lowering.ts",
  "src/geometry.ts",
  "src/geometry/joinery.ts",
].map((f) => path.join(root, f));
const program = ts.createProgram({ rootNames: rootFiles, options: { ...parsed.options, noEmit: true } });
const checker = program.getTypeChecker();
const indexFile = program.getSourceFile(path.join(root, "src/index.ts"));
const exportedNames = new Set(checker.getExportsOfModule(checker.getSymbolAtLocation(indexFile)).map((s) => s.name));

function resolveAlias(sym) {
  return sym && sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym;
}

function ownedType(sym) {
  const decl = (sym?.declarations ?? []).find(
    (d) => ts.isInterfaceDeclaration(d) || ts.isTypeAliasDeclaration(d) || ts.isEnumDeclaration(d),
  );
  if (!decl) return null;
  const file = decl.getSourceFile().fileName.replace(/\\/g, "/");
  if (!file.startsWith(`${SRC}/`)) return null;
  return { name: sym.getName(), decl, file: path.relative(root, file).replace(/\\/g, "/") };
}

function declarationOf(file, name) {
  const sf = program.getSourceFile(path.join(root, file));
  const moduleSymbol = sf ? checker.getSymbolAtLocation(sf) : undefined;
  const sym = moduleSymbol ? checker.getExportsOfModule(moduleSymbol).find((s) => s.name === name) : undefined;
  return sym?.declarations?.[0];
}

// The nodes that make up a root's signature.
function signatureNodes(decl) {
  if (ts.isFunctionDeclaration(decl))
    return [...(decl.typeParameters ?? []), ...decl.parameters, decl.type].filter(Boolean);
  if (ts.isVariableDeclaration(decl)) {
    const init = decl.initializer;
    const fn = init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) ? init : undefined;
    return [decl.type, ...(fn ? [...(fn.typeParameters ?? []), ...fn.parameters, fn.type] : [])].filter(Boolean);
  }
  return [decl];
}

// stopAtExported = true: do not expand a type that index.ts already exports (its own closure is a separate
// question); false: the full transitive closure, exactly like test/public-surface.test.ts.
function closureOf(rootFile, rootName, stopAtExported, assumed) {
  const decl = declarationOf(rootFile, rootName);
  if (!decl) return { found: false, types: [] };
  const found = new Map();
  const visited = new Set();
  const queue = [...signatureNodes(decl)];
  while (queue.length > 0) {
    const node = queue.shift();
    const visit = (n) => {
      let sym;
      if (ts.isTypeReferenceNode(n)) {
        const id = ts.isIdentifier(n.typeName) ? n.typeName : n.typeName.right;
        sym = resolveAlias(checker.getSymbolAtLocation(id));
      } else if (ts.isImportTypeNode(n) && n.qualifier) {
        const id = ts.isIdentifier(n.qualifier) ? n.qualifier : n.qualifier.right;
        sym = resolveAlias(checker.getSymbolAtLocation(id));
      }
      const hit = sym ? ownedType(sym) : null;
      if (hit) {
        if (!found.has(hit.name)) found.set(hit.name, hit.file);
        if (!visited.has(hit.decl) && !(stopAtExported && (exportedNames.has(hit.name) || assumed.has(hit.name)))) {
          visited.add(hit.decl);
          queue.push(hit.decl);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
  }
  const types = [...found.entries()]
    .map(([name, file]) => ({ name, file, exportedFromIndex: exportedNames.has(name) || assumed.has(name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { found: true, types };
}

const roots = [
  ["src/analyze.ts", "resolvePlan"],
  ["src/wall-lowering.ts", "joinWallSet"],
  ["src/geometry/joinery.ts", "loopsToPolygons"],
  ["src/geometry.ts", "doorSwing"],
];
function summarise(stopAtExported, assumed = new Set()) {
  const perRoot = {};
  roots.forEach(([file, name]) => {
    perRoot[name] = closureOf(file, name, stopAtExported, assumed);
  });
  const all = new Map();
  Object.values(perRoot).forEach((r) => {
    r.types.forEach((t) => {
      all.set(t.name, t);
    });
  });
  const missing = [...all.values()].filter((t) => !t.exportedFromIndex).sort((a, b) => a.name.localeCompare(b.name));
  return { perRoot, missing };
}

const full = summarise(false);
const frontier = summarise(true);
// The names the C1 PR would add (value exports plus the 14 types of the frontier closure, plus the C2 element
// type names). Pretending they are exported must leave the frontier closure with nothing missing.
const PROPOSED_C1 = [
  "resolvePlan",
  "joinWallSet",
  "loopsToPolygons",
  "doorSwing",
  ...frontier.missing.map((t) => t.name),
];
const PROPOSED_C2 = ["ROpening", "RStair", "RElevator", "REscalator", "RRoof", "RVoid", "ROutdoor", "RFence"];
const assumed = new Set([...PROPOSED_C1, ...PROPOSED_C2]);
const afterFrontier = summarise(true, assumed);
const result = {
  exportCount: exportedNames.size,
  full,
  frontier,
  proposal: {
    c1Values: PROPOSED_C1.filter((n) => !frontier.missing.some((t) => t.name === n)),
    c1Types: frontier.missing.map((t) => t.name),
    c2Types: PROPOSED_C2,
    alreadyExported: [...assumed].filter((n) => exportedNames.has(n)),
    missingAfter: afterFrontier.missing.map((t) => t.name),
  },
};
if (outFile) writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`);
console.log("index.ts export count:", exportedNames.size);
[
  ["full transitive closure (public-surface.test.ts method)", full],
  ["frontier closure (stops at types index.ts already exports)", frontier],
].forEach(([label, r]) => {
  console.log(`== ${label}`);
  Object.entries(r.perRoot).forEach(([name, one]) => {
    const miss = one.types.filter((t) => !t.exportedFromIndex).map((t) => t.name);
    console.log(` ${name}: ${one.types.length} reachable, ${miss.length} missing: ${miss.join(", ") || "-"}`);
  });
  console.log(` missing overall: ${r.missing.length}`);
});
console.log(`proposal: ${result.proposal.c1Types.length} C1 types + ${PROPOSED_C2.length} C2 type names + 4 values`);
console.log(`  already exported (collision check): ${result.proposal.alreadyExported.join(", ") || "none"}`);
console.log(
  `  frontier closure still missing after the proposal: ${result.proposal.missingAfter.join(", ") || "nothing"}`,
);
