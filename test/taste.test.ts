/**
 * `taste()` and `arch score --taste` (ADR 0032, plan-soundness PS5.1a): the exact arithmetic,
 * the report's shape and key order, the advice table, the validity cap and its layers, the
 * counted budget, each criterion's acceptance line from the design (§3), and the CLI contract
 * (exit 0 on a measurement, 2 on compile errors, 3 on bad usage).
 *
 * The corpus-wide laws live beside this file: `taste-separation` (row 5's monotone separation),
 * `taste-digests` (the pinned report table), `taste-invisible` (describe/lint/compile untouched),
 * `taste-equivariance` (translation and D4) and `taste-budget` (the measured budget).
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ERROR_CATALOG } from "../src/error-catalog.js";
import { fmtPermyriad } from "../src/num-format.js";
import { fmtRatio, meanPermyriad, ramp, roundHalfUp } from "../src/taste/arith.js";
import { TASTE_CRITERIA } from "../src/taste/criteria.js";
import {
  compile,
  describe as describePlan,
  LINT_CODE_LAYERS,
  lint,
  taste,
  TASTE_ADVICE,
  TASTE_PROFILE_NAMES,
  TASTE_SUBSCORES,
  type TasteReport,
} from "../src/index.js";
import { tasteWithBudget } from "../src/taste/index.js";
import { TASTE_SOURCES, TASTE_WORLD } from "./taste-sources.js";

const read = (p: string): string => readFileSync(p, "utf8");
const CHAIN = "test/defect-corpus/circulation-privacy/two-bed-chain";
const crit = (r: TasteReport, id: string) => r.criteria.find((c) => c.id === id)!;

describe("exact arithmetic", () => {
  it("fmtPermyriad prints an integer permyriad from its digits", () => {
    expect(fmtPermyriad(0)).toBe("0");
    expect(fmtPermyriad(5)).toBe("0.0005");
    expect(fmtPermyriad(5000)).toBe("0.5");
    expect(fmtPermyriad(6125)).toBe("0.6125");
    expect(fmtPermyriad(6667)).toBe("0.6667");
    expect(fmtPermyriad(10000)).toBe("1");
    for (let p = 0; p <= 10000; p++) expect(JSON.stringify(Number(fmtPermyriad(p)))).toBe(fmtPermyriad(p));
    expect(() => fmtPermyriad(10001)).toThrow(RangeError);
    expect(() => fmtPermyriad(0.5)).toThrow(RangeError);
  });

  it("roundHalfUp decides ties upward in integers, negatives included", () => {
    expect(roundHalfUp(1n, 2n)).toBe(1n);
    expect(roundHalfUp(-1n, 2n)).toBe(0n);
    expect(roundHalfUp(2n, 3n)).toBe(1n);
    expect(roundHalfUp(-5n, 3n)).toBe(-2n);
  });

  it("ramp maps zero → 0 and one → 10000, clamps, and reads lower-is-better ramps", () => {
    const r = (n: bigint, d: bigint) => ({ num: n, den: d });
    expect(ramp(r(0n, 1n), r(0n, 1n), r(1n, 1n))).toBe(0);
    expect(ramp(r(1n, 2n), r(0n, 1n), r(1n, 1n))).toBe(5000);
    expect(ramp(r(2n, 3n), r(0n, 1n), r(1n, 1n))).toBe(6667);
    expect(ramp(r(3n, 1n), r(0n, 1n), r(1n, 1n))).toBe(10000);
    // R14: rank 3 of 5 on the ramp 5 → 2 reads 2/3.
    expect(ramp(r(3n, 1n), r(5n, 1n), r(2n, 1n))).toBe(6667);
    expect(ramp(r(6n, 1n), r(5n, 1n), r(2n, 1n))).toBe(0);
    // R7: 0.06 on 0 → 8/100 is 0.75.
    expect(ramp(r(6n, 100n), r(0n, 1n), r(8n, 100n))).toBe(7500);
  });

  it("means are weighted and rounded half up; an empty mean is null", () => {
    expect(meanPermyriad([])).toBeNull();
    expect(
      meanPermyriad([
        { p: 5000, w: 1 },
        { p: 6667, w: 1 },
        { p: 10000, w: 1 },
      ]),
    ).toBe(7222);
    expect(
      meanPermyriad([
        { p: 1, w: 1 },
        { p: 2, w: 1 },
      ]),
    ).toBe(2);
    expect(fmtRatio(144n, 1200n, 4)).toBe("0.12");
    expect(fmtRatio(1n, 3n, 2)).toBe("0.33");
  });
});

describe("the advice table (A_* codes are advice, not diagnostics)", () => {
  it("every criterion has one row with an A_ code, a source and the words it asks with", () => {
    expect(TASTE_ADVICE.map((r) => r.id)).toEqual(TASTE_CRITERIA.map((c) => c.id));
    const codes = TASTE_ADVICE.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const row of TASTE_ADVICE) {
      expect(row.code).toMatch(/^A_[A-Z_]+$/);
      expect(ERROR_CATALOG[row.code], `${row.code} must not be in the error catalogue`).toBeUndefined();
      expect(row.source.length).toBeGreaterThan(10);
      expect(["V", "S", "M"]).toContain(row.verified);
      expect(row.asks.length).toBeGreaterThan(10);
      expect(TASTE_SUBSCORES).toContain(row.subscore);
    }
  });
});

describe("the report", () => {
  const r = taste(read(`${CHAIN}.arch`));

  it("has the fixed key order of the design (§2.2)", () => {
    expect(Object.keys(r)).toEqual([
      "profile",
      "ok",
      "score",
      "uncapped",
      "capped",
      "validity",
      "advisory",
      "coverage",
      "subscores",
      "criteria",
    ]);
    expect(Object.keys(r.validity)).toEqual(["pass", "warnings", "codes", "drafting"]);
    expect(Object.keys(r.validity.drafting)).toEqual(["warnings", "codes"]);
    expect(Object.keys(r.coverage)).toEqual(["rooms", "classified", "unclassified", "weight", "skipped"]);
    expect(Object.keys(r.subscores)).toEqual([...TASTE_SUBSCORES]);
    expect(Object.keys(r.criteria[0]!)).toEqual([
      "id",
      "name",
      "subscore",
      "kind",
      "weight",
      "assessable",
      "measured",
      "score",
      "source",
      "verified",
      "advice",
      "message",
      "evidence",
    ]);
    expect(r.criteria.map((c) => c.id)).toEqual(["R3", "R7", "R14"]);
  });

  it("caps at 0.5 while a validity warning stands, and says what it was before", () => {
    expect(r.validity.pass).toBe(false);
    expect(r.validity.codes).toContain("W_ROOM_VIA_PRIVATE");
    expect(r.capped).toBe(true);
    expect(r.score).toBe(0.5);
    expect(r.uncapped).toBe(0.7222);
  });

  it("a drafting-layer warning is listed and never caps", () => {
    const src = `plan "Drafted" {
  units mm
  grid 100
  room id=r_living at (0,0) size 3200x4200 label "Living Room" uses living
  walls from rooms exterior 200 partition 100
  door id=d_front on r_living.bottom at center width 900 swing into r_living
  window id=w_n on r_living.top at center width 1200
  dim (500,1000)->(2500,1000)
}`;
    const t = taste(src);
    expect(t.validity.drafting.codes).toEqual(["W_DIM_INSIDE"]);
    expect(t.validity.drafting.warnings).toBe(1);
    expect(t.validity.pass).toBe(true);
    expect(t.capped).toBe(false);
    expect(t.score).toBe(1);
  });

  it("a compile-channel warning never caps", () => {
    const src = `plan "Overlap" {
  units mm
  room id=a at (0,0) size 3000x3000 label "Living Room" uses living
  room id=b at (2000,0) size 3000x3000 label "Store" uses storage
}`;
    // The plan really carries the compile-channel warning…
    expect(compile(src).diagnostics.some((d) => d.code === "W_ROOM_OVERLAP" && d.severity === "warning")).toBe(true);
    // …and the cap counts exactly default lint()'s validity-layer warnings, nothing from compile().
    const t = taste(src);
    const validity = lint(src).filter((d) => LINT_CODE_LAYERS[d.code ?? ""] === "validity");
    expect(t.validity.codes).not.toContain("W_ROOM_OVERLAP");
    expect(t.validity.warnings).toBe(validity.length);
    expect(t.validity.pass).toBe(validity.length === 0);
  });

  it("a plan that does not resolve is not scored, and the call does not throw", () => {
    const t = taste(`plan "x" { room id=a at (0,0) size 1x }`);
    expect(t.ok).toBe(false);
    expect(t.score).toBeNull();
    expect(t.capped).toBe(false);
    expect(t.criteria).toEqual([]);
  });

  it("an unknown profile is a caller error", () => {
    expect(TASTE_PROFILE_NAMES).toEqual(["generic"]);
    expect(() => taste(read(`${CHAIN}.arch`), { profile: "uk" })).toThrow(/unknown taste profile "uk"/);
  });

  it("a budget too small for a criterion skips it as taste-budget, counted, never run", () => {
    const t = tasteWithBudget(read(`${CHAIN}.arch`), {}, 0);
    expect(t.score).toBeNull();
    expect(t.criteria.every((c) => !c.assessable && c.reason === "taste-budget")).toBe(true);
    expect(t.coverage.skipped.map((s) => s.reason)).toEqual(["taste-budget", "taste-budget", "taste-budget"]);
    expect(t.coverage.weight).toEqual({ assessable: 0, total: 3 });
  });
});

describe("each criterion's acceptance line (design §3)", () => {
  const bad = taste(read(`${CHAIN}.arch`));
  const good = taste(read(`${CHAIN}.clean.arch`));

  it("R3: two-bed-chain scores 1/2 and its twin 2/2; two-bed (living and bedrooms at depth 2) scores 1", () => {
    expect(crit(bad, "R3").measured).toEqual({ num: 1, den: 2 });
    expect(crit(bad, "R3").score).toBe(0.5);
    expect(crit(bad, "R3").advice).toBe("A_INTIMACY_INVERSION");
    expect(crit(bad, "R3").evidence).toEqual([{ ids: ["r_living", "r_master"], fact: "depth 4 > depth 3" }]);
    expect(crit(good, "R3").measured).toEqual({ num: 2, den: 2 });
    expect(crit(good, "R3").advice).toBeNull();
    expect(crit(taste(read("examples/two-bed.arch")), "R3").score).toBe(1);
  });

  it("R7: a 12 m² net living room with a 1200 mm window at default heights reads 0.12 → 1; 600 mm reads 0.75", () => {
    const wide = crit(taste(read("test/taste-corpus/r7-small-window.good.arch")), "R7");
    expect(wide.score).toBe(1);
    expect(wide.evidence[0]!.fact).toBe("glazing 1.44 m² / net floor 12 m² = 0.12 (target 0.08); heights default");
    const narrow = crit(taste(read("test/taste-corpus/r7-small-window.arch")), "R7");
    expect(narrow.score).toBe(0.75);
    expect(narrow.measured).toEqual({ num: 0, den: 1 });
  });

  it("R7 says `heights default` per room: only a room whose own windows stand at 900/2100", () => {
    const src = `plan "Two rooms" {
  units mm
  grid 100
  room id=r_a at (0,0) size 3200x4200 label "Living Room" uses living
  room id=r_b at (3200,0) size 3200x4200 label "Bedroom" uses bedroom
  walls from rooms exterior 200 partition 100
  door id=d_front on r_a.bottom at center width 900 swing into r_a
  door id=d_ab between r_a and r_b at center width 900 swing into r_b
  window id=w_a on r_a.top at center width 1200 sill 300 head 2400
  window id=w_b on r_b.top at center width 1200
}`;
    const facts = crit(taste(src), "R7").evidence.map((e) => e.fact);
    expect(facts[0]).not.toContain("heights default");
    expect(facts[0]).toContain("glazing 2.52 m²");
    expect(facts[1]).toContain("; heights default");
  });

  it("R7 files a habitable room whose area rounds to 0 m² as a `too-small` skip, never silently", () => {
    const src = `plan "Speck" {
  units mm
  room id=r_a at (0,0) size 4000x3000 label "Living Room" uses living
  room id=r_s at (4000,0) size 40x40 label "Bedroom" uses bedroom
  wall id=shell exterior thickness 200 { (0,0) (4000,0) (4000,3000) (0,3000) close }
  door id=d_front on shell at 60% width 900
  window id=w_n on shell at 10% width 1500
}`;
    const t = taste(src);
    expect(t.coverage.skipped).toContainEqual({ criterion: "R7", reason: "too-small", room: "r_s" });
    expect(crit(t, "R7").measured?.den).toBe(1);
  });

  it("R14: two-bed-chain ranks 3 of 5 (0.6667), its twin 1 of 5 (1)", () => {
    expect(crit(bad, "R14").measured).toEqual({ num: 3, den: 5 });
    expect(crit(bad, "R14").score).toBe(0.6667);
    expect(crit(good, "R14").measured).toEqual({ num: 1, den: 5 });
    expect(crit(good, "R14").score).toBe(1);
  });

  it("an upper storey is skipped for the depth readers, filed with its level", () => {
    const t = taste(read("examples/townhouse.arch"), { world: TASTE_WORLD });
    const upper = t.coverage.skipped.filter((s) => s.reason === "upper-storey");
    expect(upper.map((s) => `${s.criterion}@${s.level}`)).toEqual(["R3@2", "R3@3", "R14@2", "R14@3"]);
  });
});

describe("messages name rooms by label, never by id (the lint iron law, applied to taste)", () => {
  it("every room a message names is named by its label (an id only for a room with none)", () => {
    const bad: string[] = [];
    let quoted = 0;
    for (const { name, src } of TASTE_SOURCES) {
      const t = taste(src, { world: TASTE_WORLD });
      const s = describePlan(src, { world: TASTE_WORLD });
      const rooms = [...s.rooms, ...(s.levels ?? []).flatMap((l) => l.rooms)];
      // What a person would call each room: its label, or its id when it has no label.
      const names = new Set(rooms.map((r) => r.label ?? r.id));
      for (const c of t.criteria) {
        for (const m of c.message.matchAll(/"([^"]+)"/g)) {
          quoted++;
          if (!names.has(m[1]!)) bad.push(`${name} ${c.id}: ${m[1]} in ${c.message}`);
        }
      }
    }
    expect(quoted).toBeGreaterThan(50); // the check reached messages that name rooms
    expect(bad).toEqual([]);
  }, 300_000);
});

describe("arch score --taste (the CLI contract)", () => {
  const run = (args: string[], input?: string) => {
    const r = spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
      input,
      encoding: "utf8",
      cwd: process.cwd(),
    });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
  };

  it("--json prints taste()'s report and exits 0, capped or not", () => {
    const r = run(["score", `${CHAIN}.arch`, "--taste", "generic", "--json"]);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual(taste(read(`${CHAIN}.arch`)));
  }, 30000);

  it("prints a human summary line and exits 0", () => {
    const r = run(["score", `${CHAIN}.arch`, "--taste", "generic"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("taste generic: 0.5 (capped; uncapped 0.7222) · judged 3/3 of the weight\n");
    expect(r.stderr).toContain("A_INTIMACY_INVERSION");
  }, 30000);

  it("--taste with --brief is a usage error (exit 3)", () => {
    const r = run(["score", `${CHAIN}.arch`, "--taste", "generic", "--brief", "x.json"]);
    expect(r.status).toBe(3);
  }, 30000);

  it("an unknown profile exits 3 with a did-you-mean", () => {
    const r = run(["score", `${CHAIN}.arch`, "--taste", "generik"]);
    expect(r.status).toBe(3);
    expect(r.stderr).toContain('did you mean "generic"');
  }, 30000);

  it("a plan with compile errors exits 2 and prints them", () => {
    const r = run(["score", "-", "--taste", "generic", "--json"], `plan "x" { room id=a at (0,0) size 1x }`);
    expect(r.status).toBe(2);
    expect(JSON.parse(r.stdout).ok).toBe(false);
  }, 30000);
});
