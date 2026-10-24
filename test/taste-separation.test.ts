/**
 * The row-5 law (plan-soundness §7 row 5; ADR 0032; design §4): the taste score separates the
 * corpus's known-bad from its known-good plans MONOTONICALLY — on the comparisons the corpus
 * knows, never as a ranking of unrelated plans.
 *
 * Three sets of pairs, each a weaker plan and its better twin:
 *
 *  - **Set A**: defect-corpus pairs a PS5.1a criterion reads, compared on the OWNING subscore
 *    (zoning = R3, circulation = R14, light = R7). Each row is pinned with its relation; `<`
 *    rows are the pairs the design measured as separated, `=` rows are defects owned by lint
 *    that no taste criterion reads, and `n/a` is a subscore neither twin can judge. No row may
 *    read `>`.
 *  - **Set B**: defect-corpus pairs lint separates (the case warns, the twin is lint-clean),
 *    computed from the corpus, never listed. The twin's total must exceed the case's. A pair
 *    where it does not is a calibration finding, pinned in {@link LEDGER} with its reason; the
 *    ledger is checked both ways, so it cannot go stale.
 *  - **Set C**: `test/taste-corpus/`, lint-clean pairs that differ in one taste fact: strict on
 *    the criterion the header names and on the total, both twins asserted lint-clean.
 *
 * The concordance over A ∪ B ∪ C (each pair once) is printed like the defect corpus's catch
 * rate, and **reversed = 0** outside the ledger is the acceptance. A moved row is a finding to
 * explain, never a table to edit to green.
 */

import { describe, expect, it } from "vitest";
import { lint, taste, type TasteReport, type TasteSubscore } from "../src/index.js";
import { defectPairs, type TastePair, tasteCorpusPairs, TASTE_WORLD } from "./taste-sources.js";

type Rel = "<" | "=" | ">" | "n/a";

/** Set A, pinned (design §4 set A, restricted to the subscores PS5.1a's criteria fill). */
const SET_A: ReadonlyArray<[string, TasteSubscore, Rel]> = [
  ["circulation-privacy/two-bed-chain", "zoning", "<"],
  ["circulation-privacy/two-bed-chain", "circulation", "<"],
  ["circulation-privacy/living-via-bedrooms", "zoning", "<"],
  ["circulation-privacy/living-via-bedrooms", "circulation", "<"],
  ["circulation-privacy/entry-into-bedroom", "zoning", "<"],
  // Two rooms in the system: R14 needs three.
  ["circulation-privacy/entry-into-bedroom", "circulation", "n/a"],
  // The defect is a route through a bedroom; equal on R3, which reads depths only.
  ["circulation-privacy/bedroom-via-bedroom", "zoning", "="],
  // The defect is a bath behind a bedroom; R3 reads public-to-bedroom depths only.
  ["circulation-privacy/bath-via-bedroom", "zoning", "="],
  ["daylight/accessible-living-no-window", "light", "<"],
  ["daylight/bedroom-no-window", "light", "<"],
  ["daylight/living-bay-no-window", "light", "<"],
  ["daylight/living-label-no-window", "light", "<"],
];

/**
 * Set B pairs whose twin does not out-score the case, each with its reason. A finding, not an
 * exemption: the reason says why the order is right or what would fix the calibration.
 */
const LEDGER: Readonly<Record<string, string>> = {
  "openings-ignore-walls/door-window-overlap-chamfer":
    "the fix narrows the cafe's window, so the twin's daylight ratio (3.68 %) is lower than the case's (6.14 %); " +
    "the case is capped at 0.5 and the twin scores 0.4606 on R7 alone. The order is a true taste reading of a " +
    "valid but under-lit room, not a reversal of the defect",
};

const cache = new Map<string, TasteReport>();
const scoreOf = (name: string, src: string): TasteReport => {
  let r = cache.get(name);
  if (!r) {
    r = taste(src, { world: TASTE_WORLD });
    cache.set(name, r);
  }
  return r;
};

const rel = (a: number | null, b: number | null): Rel =>
  a === null || b === null ? "n/a" : a < b ? "<" : a === b ? "=" : ">";

const PAIRS = defectPairs();
const byName = new Map(PAIRS.map((p) => [p.slug, p]));
const lintClean = (p: TastePair, side: "bad" | "good") => lint(p[side].src, { world: TASTE_WORLD }).length === 0;

type Verdict = "ordered" | "tied" | "reversed";
const verdicts = new Map<string, { verdict: Verdict; sets: string[] }>();
function record(key: string, set: string, v: Verdict): void {
  const prev = verdicts.get(key);
  if (!prev) {
    verdicts.set(key, { verdict: v, sets: [set] });
    return;
  }
  prev.sets.push(set);
  // A pair is reversed if any set reverses it, ordered if any orders it and none reverses it.
  if (v === "reversed" || (v === "ordered" && prev.verdict === "tied")) prev.verdict = v;
}

describe("set A: the owning subscore of each pair a criterion reads", () => {
  for (const [slug, sub, want] of SET_A) {
    it(`${slug} · ${sub}: ${want}`, () => {
      const p = byName.get(slug);
      expect(p, `no defect-corpus pair ${slug}`).toBeDefined();
      const got = rel(
        scoreOf(p!.bad.name, p!.bad.src).subscores[sub],
        scoreOf(p!.good.name, p!.good.src).subscores[sub],
      );
      expect(got).toBe(want);
    });
  }

  it("records each pair's verdict over its owning subscores", () => {
    const slugs = [...new Set(SET_A.map(([s]) => s))];
    for (const slug of slugs) {
      const p = byName.get(slug)!;
      const rels = SET_A.filter(([s]) => s === slug).map(([, sub]) =>
        rel(scoreOf(p.bad.name, p.bad.src).subscores[sub], scoreOf(p.good.name, p.good.src).subscores[sub]),
      );
      record(`defect:${slug}`, "A", rels.includes(">") ? "reversed" : rels.includes("<") ? "ordered" : "tied");
    }
    expect(slugs.length).toBe(9);
  });
});

describe("set B: pairs lint separates", () => {
  const setB = PAIRS.filter((p) => !lintClean(p, "bad") && lintClean(p, "good"));

  it("is computed from the corpus and not empty", () => {
    expect(setB.length).toBeGreaterThan(20);
  });

  it("the twin's total exceeds the case's, except the ledger's pinned findings (checked both ways)", () => {
    const misses: string[] = [];
    for (const p of setB) {
      const b = scoreOf(p.bad.name, p.bad.src);
      const g = scoreOf(p.good.name, p.good.src);
      const r = rel(b.score, g.score);
      // The cap holds the case at or under 0.5.
      if (b.score !== null) expect(b.score, p.slug).toBeLessThanOrEqual(0.5);
      if (r === ">" || r === "=") misses.push(p.slug);
      record(`defect:${p.slug}`, "B", r === "<" ? "ordered" : r === ">" ? "reversed" : "tied");
    }
    expect(misses.sort()).toEqual(Object.keys(LEDGER).sort());
  }, 300_000);
});

describe("set C: the taste corpus", () => {
  const pairs = tasteCorpusPairs();

  it("has a pair for every PS5.1a criterion", () => {
    expect([...new Set(pairs.map((p) => p.criterion))].sort()).toEqual(["R14", "R3", "R7"]);
  });

  for (const p of pairs) {
    it(`${p.slug} (${p.criterion}): both twins lint clean; strict on the criterion and the total`, () => {
      expect(lint(p.bad.src)).toEqual([]);
      expect(lint(p.good.src)).toEqual([]);
      const b = scoreOf(p.bad.name, p.bad.src);
      const g = scoreOf(p.good.name, p.good.src);
      const cb = b.criteria.find((c) => c.id === p.criterion)!;
      const cg = g.criteria.find((c) => c.id === p.criterion)!;
      expect(rel(cb.score, cg.score)).toBe("<");
      expect(rel(b.score, g.score)).toBe("<");
      record(`taste:${p.slug}`, "C", "ordered");
    });
  }
});

describe("the concordance over A ∪ B ∪ C", () => {
  it("prints ordered / tied / reversed, and nothing outside the ledger is reversed", () => {
    const all = [...verdicts.entries()];
    const count = (v: Verdict) => all.filter(([, x]) => x.verdict === v).length;
    const reversed = all.filter(([, x]) => x.verdict === "reversed").map(([k]) => k.replace(/^defect:/, ""));
    const unexplained = reversed.filter((k) => !(k in LEDGER));
    console.log(
      `taste concordance (A ∪ B ∪ C): ${all.length} pairs — ${count("ordered")} ordered, ${count("tied")} tied, ` +
        `${count("reversed")} reversed (${reversed.length - unexplained.length} in the ledger)`,
    );
    expect(all.length).toBeGreaterThan(30);
    expect(unexplained).toEqual([]);
  });
});
