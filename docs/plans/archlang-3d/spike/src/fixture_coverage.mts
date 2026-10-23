/** Dump the core's fixture vocabulary (families, aliases, catalogue flags) for the asset-coverage analysis.
 *  Usage: tsx fixture_coverage.mts <core-root> > fixture-families.json */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync, readdirSync } from "node:fs";
const root = path.resolve(process.argv[2]!);
const src = (p: string) => import(pathToFileURL(path.join(root, "src", p)).href);
const g = await src("elements/fixtures-glyphs.ts");
const c = await src("fixtures-catalog.ts");
const fam = new Map<string, string[]>();
for (const w of g.FIXTURE_CATEGORIES as string[]) {
  const k = g.canonicalFixture(w);
  (fam.get(k) ?? fam.set(k, []).get(k)!).push(w);
}
const out = [...fam].map(([canon, words]) => {
  const s = c.fixtureSpec(canon) ?? {};
  return {
    canonical: canon,
    aliases: words.filter((w) => w !== canon),
    glyph: g.hasFixtureGlyph(canon),
    requiresWall: !!s.requiresWall,
    footprint: s.footprint ?? null,
    clearanceMm: s.clearanceMm ?? 0,
    layer: c.cutPlaneLayer(canon),
    symmetric: !!s.symmetric,
    directional: !!s.directional,
    zones: s.zones ?? [],
  };
});
// usage in the shipped examples: which families are actually drawn?
const used = new Map<string, number>();
const exDir = path.join(root, "examples");
for (const f of readdirSync(exDir).filter((x) => x.endsWith(".arch") || x === "lib")) {
  if (f === "lib") continue;
  const t = readFileSync(path.join(exDir, f), "utf8");
  for (const m of t.matchAll(/^\s*furniture\s+(?:id=\S+\s+)?([a-z_0-9]+)/gm)) {
    const k = g.canonicalFixture(m[1]!) ?? "(free:" + m[1] + ")";
    used.set(k, (used.get(k) ?? 0) + 1);
  }
}
console.log(
  JSON.stringify(
    {
      families: out.length,
      words: g.FIXTURE_CATEGORIES.length,
      withGlyph: out.filter((x) => x.glyph).length,
      usedInExamples: Object.fromEntries([...used].sort((a, b) => b[1] - a[1])),
      data: out,
    },
    null,
    1,
  ),
);
