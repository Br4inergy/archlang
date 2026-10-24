/**
 * `nextDiagnostic()` (plan-soundness PS5.3): the one item to fix first, by fixed precedence —
 * error → validity → drafting → compile warning → intent (gating, graph, advisory) → profile →
 * taste — and, within a tier, emission order.
 *
 * - Unit: every tier alone, every adjacent pair of tiers, emission order within a tier, the
 *   profile multiset difference, the taste minimum, and `null`.
 * - Table: over the defect corpus, each `done` case's `next` is the first validity warning of
 *   its default `lint()` in emission order, else the first drafting one; it is the case's own
 *   `expect` code (and that code's tier) whenever that code is the plan's only warning.
 * - L1: computing `next` with every input over every example leaves SVG, `describe()` and
 *   `lint()` at the pinned byte-identity baseline (`nextDiagnostic` only reads results it is
 *   handed; the measuring is `compile`/`lint`/`validateIntent`/`taste`, run here first).
 */

import { describe, expect, it } from "vitest";
import {
  compile,
  describe as describePlan,
  type Diagnostic,
  type IntentCheckResult,
  LINT_CODE_LAYERS,
  lint,
  lintWithCoverage,
  NEXT_TIERS,
  nextDiagnostic,
  type NextInput,
  taste,
  type TasteReport,
  validateIntent,
} from "../src/index.js";
import { AUTHORS_HEIGHT, BASELINE } from "./byte-identity-baseline.js";
import { type CompilerApi, allStoreysDigestWith } from "./byte-identity-digest.js";
import { heightFreeSource } from "./height-free-source.js";
import { DEFECT_SOURCES, EXAMPLE_SOURCES, TASTE_WORLD, headerOf } from "./taste-sources.js";

const W = (code: string, start = 0, extra: Partial<Diagnostic> = {}): Diagnostic => ({
  severity: "warning",
  code,
  message: `${code} message`,
  span: { start, end: start + 1 },
  ...extra,
});
const E = (code: string, start = 0): Diagnostic => ({ ...W(code, start), severity: "error" });

// Real layers: the drafting code below must really be declared drafting by its rule.
const DRAFTING = "W_DIM_TEXT_MISMATCH";
const VALIDITY = "W_ROOM_VIA_PRIVATE";

// A real intent result with a gating and an advisory violation, from a real plan.
const PLAN = `plan "Home" {
  units mm
  wall id=ext exterior thickness 200 { (0,0) (8000,0) (8000,5000) (0,5000) close }
  wall id=part partition thickness 100 { (4000,0) (4000,5000) }
  room id=bed at (0,0) size 4000x5000 label "Bedroom"
  room id=bath at (4000,0) size 4000x5000 label "Bathroom"
  door id=entry at (2000,0) width 900 wall ext
  window id=w1 at (1000,0) width 1200 wall ext
}`;
const INTENT: IntentCheckResult = validateIntent(PLAN, {
  rooms: 3,
  adjacency: { requiredEdges: { bedroom: ["bathroom"] }, source: "test" },
});
const ADVISORY_ONLY: IntentCheckResult = validateIntent(PLAN, {
  rooms: 2,
  adjacency: { requiredEdges: { bedroom: ["bathroom"] }, source: "test" },
});

/** A taste report whose criteria carry the given scores (in order), built on a real report. */
function tasteWith(scores: Array<number | null>): TasteReport {
  const real = taste(PLAN, { profile: "generic" });
  const proto = real.criteria[0]!;
  return {
    ...real,
    criteria: scores.map((s, i) => ({
      ...proto,
      id: `R${i + 1}`,
      assessable: s !== null,
      score: s,
      advice: s === null || s >= 1 ? null : `A_TEST_${i + 1}`,
      message: `criterion ${i + 1}`,
    })),
  };
}

describe("nextDiagnostic · each tier alone", () => {
  it("the layers this file relies on are the real ones", () => {
    expect(LINT_CODE_LAYERS[DRAFTING]).toBe("drafting");
    expect(LINT_CODE_LAYERS[VALIDITY]).toBe("validity");
    expect(INTENT.violations.map((v) => v.gate)).toEqual([true, false]);
    expect(ADVISORY_ONLY.violations.map((v) => v.gate)).toEqual([false]);
  });

  it("nothing to fix is null", () => {
    expect(nextDiagnostic({ diagnostics: [] })).toBeNull();
    expect(nextDiagnostic({ diagnostics: [], lint: [], profileLint: [], taste: tasteWith([1, null]) })).toBeNull();
  });

  it("error", () => {
    expect(nextDiagnostic({ diagnostics: [E("E_PARSE", 5)] })).toEqual({
      tier: "error",
      code: "E_PARSE",
      message: "E_PARSE message",
      span: [5, 6],
      hint: expect.any(String), // the catalogued fix
    });
  });

  it("validity, with the diagnostic's first hint, its storey and its module", () => {
    const d = W(VALIDITY, 3, { hints: ["first", "second"], level: 2, file: "lib/a.arch" });
    expect(nextDiagnostic({ diagnostics: [], lint: [d] })).toEqual({
      tier: "validity",
      code: VALIDITY,
      message: `${VALIDITY} message`,
      span: [3, 4],
      file: "lib/a.arch",
      level: 2,
      hint: "first",
    });
  });

  it("drafting", () => {
    expect(nextDiagnostic({ diagnostics: [], lint: [W(DRAFTING)] })?.tier).toBe("drafting");
  });

  it("a code no rule declares ranks as validity (as it does for the taste cap)", () => {
    expect(nextDiagnostic({ diagnostics: [], lint: [W("W_NOT_A_RULE")] })?.tier).toBe("validity");
  });

  it("compile-channel warning", () => {
    expect(nextDiagnostic({ diagnostics: [W("W_DOOR_OFF_WALL")] })).toMatchObject({
      tier: "warning",
      code: "W_DOOR_OFF_WALL",
    });
  });

  it("intent: gating first, with its correction prompt as the hint", () => {
    const n = nextDiagnostic({ diagnostics: [], intent: INTENT });
    expect(n).toMatchObject({
      tier: "intent",
      code: INTENT.violations[0]!.code,
      message: INTENT.violations[0]!.message,
    });
    expect(n?.hint).toEqual(expect.any(String));
  });

  it("intent: advisory when nothing gates", () => {
    expect(nextDiagnostic({ diagnostics: [], intent: ADVISORY_ONLY })).toMatchObject({
      tier: "intent",
      code: ADVISORY_ONLY.violations[0]!.code,
    });
  });

  it("intent: a graph mismatch sits between gating and advisory, with no code", () => {
    const graph = {
      ok: false,
      missing_rooms: [],
      missing_connections: [["a", "b"]] as [string, string][],
      extra_connections: [],
    };
    expect(nextDiagnostic({ diagnostics: [], intent: ADVISORY_ONLY, graph })).toEqual({
      tier: "intent",
      code: null,
      message: "graph: missing connection a — b",
    });
    expect(nextDiagnostic({ diagnostics: [], intent: INTENT, graph })?.code).toBe(INTENT.violations[0]!.code);
    expect(nextDiagnostic({ diagnostics: [], graph: { ...graph, ok: true, missing_connections: [] } })).toBeNull();
  });

  it("profile: a warning only the profile raises; a default warning it repeats ranks as its own layer", () => {
    const shared = W(VALIDITY, 10);
    const extra = W("W_DOOR_TOO_NARROW", 20);
    // The profile repeats the default warning (perhaps quoting another threshold): validity wins.
    expect(
      nextDiagnostic({ diagnostics: [], lint: [shared], profileLint: [{ ...shared, message: "reworded" }, extra] })
        ?.tier,
    ).toBe("validity");
    // Default lint() clean: the profile's first warning, in emission order.
    expect(nextDiagnostic({ diagnostics: [], lint: [], profileLint: [extra, shared] })).toMatchObject({
      tier: "profile",
      code: "W_DOOR_TOO_NARROW",
    });
  });

  it("taste: the lowest score below 1 wins, the first on a tie, unassessable never", () => {
    expect(nextDiagnostic({ diagnostics: [], taste: tasteWith([0.75, null, 0.5, 0.5, 1]) })).toEqual({
      tier: "taste",
      code: "A_TEST_3",
      message: "criterion 3",
      hint: expect.stringMatching(/^R3 .* scored 0\.5 under generic \(source: /),
    });
    expect(nextDiagnostic({ diagnostics: [], taste: tasteWith([null, 1, 1]) })).toBeNull();
    expect(nextDiagnostic({ diagnostics: [], taste: { ...tasteWith([0.1]), ok: false } })).toBeNull();
  });
});

describe("nextDiagnostic · precedence between tiers", () => {
  // One input per tier, highest first; each must beat every tier after it.
  const inputs: Record<(typeof NEXT_TIERS)[number], NextInput> = {
    error: { diagnostics: [E("E_PARSE")] },
    validity: { diagnostics: [], lint: [W(VALIDITY)] },
    drafting: { diagnostics: [], lint: [W(DRAFTING)] },
    warning: { diagnostics: [W("W_DOOR_OFF_WALL")] },
    intent: { diagnostics: [], intent: INTENT },
    profile: { diagnostics: [], profileLint: [W("W_DOOR_TOO_NARROW", 40)] },
    taste: { diagnostics: [], taste: tasteWith([0.25]) },
  };
  const merge = (tiers: readonly (typeof NEXT_TIERS)[number][]): NextInput => {
    const m: NextInput = { diagnostics: [] };
    for (const t of tiers) {
      const i = inputs[t];
      m.diagnostics = [...m.diagnostics, ...i.diagnostics];
      if (i.lint) m.lint = [...(m.lint ?? []), ...i.lint];
      if (i.intent) m.intent = i.intent;
      if (i.profileLint) m.profileLint = [...(m.lint ?? []), ...i.profileLint];
      if (i.taste) m.taste = i.taste;
    }
    return m;
  };

  it("the tiers are the card's order, with drafting after validity and compile warnings before intent", () => {
    expect(NEXT_TIERS).toEqual(["error", "validity", "drafting", "warning", "intent", "profile", "taste"]);
  });

  for (let i = 0; i < NEXT_TIERS.length; i++) {
    const rest = NEXT_TIERS.slice(i);
    it(`${NEXT_TIERS[i]} beats ${rest.slice(1).join(", ") || "nothing"}`, () => {
      // Every tier from i on is present, in reverse emission order so position cannot win.
      expect(nextDiagnostic(merge([...rest].reverse()))?.tier).toBe(NEXT_TIERS[i]);
    });
  }

  it("within a tier, emission order — not code, not position in the file", () => {
    const lintOrder = [W("W_ZZZ_LATER_CODE", 900), W("W_AAA_EARLIER_CODE", 1)];
    expect(nextDiagnostic({ diagnostics: [], lint: lintOrder })?.code).toBe("W_ZZZ_LATER_CODE");
    expect(nextDiagnostic({ diagnostics: [E("E_B", 50), E("E_A", 2)] })?.code).toBe("E_B");
  });

  it("an error preempts even when lint() returned warnings (a caller that passes both)", () => {
    expect(nextDiagnostic({ diagnostics: [W("W_DOOR_OFF_WALL"), E("E_PARSE", 9)], lint: [W(VALIDITY)] })?.tier).toBe(
      "error",
    );
  });
});

describe("nextDiagnostic · the defect corpus table", () => {
  const cases = DEFECT_SOURCES.filter((s) => !s.name.endsWith(".clean.arch"));
  const rows = cases.map((s) => {
    const h = headerOf(s.src);
    const linted = lintWithCoverage(s.src);
    const warnings = linted.diagnostics.filter((d) => d.severity === "warning");
    const next = nextDiagnostic({ diagnostics: compile(s.src).diagnostics, lint: linted.diagnostics });
    return { name: s.name, expect: h.expect!, status: h.status!, warnings, layers: linted.layers, next };
  });

  it("covers the corpus (the table is not vacuous)", () => {
    expect(rows.length).toBeGreaterThan(60);
    expect(rows.filter((r) => r.status === "done").length).toBeGreaterThan(40);
  });

  it("every bad twin's next is the first validity warning in emission order, else the first drafting one", () => {
    const wrong = rows.flatMap((r) => {
      const first = r.warnings.find((d) => r.layers[d.code!] !== "drafting") ?? r.warnings[0];
      const want = first ? { tier: r.layers[first.code!] ?? "validity", code: first.code } : null;
      const got = r.next ? { tier: r.next.tier, code: r.next.code } : null;
      return JSON.stringify(got) === JSON.stringify(want) ? [] : [`${r.name}: ${JSON.stringify(got)}`];
    });
    expect(wrong).toEqual([]);
  });

  it("a done case whose only warning is its expect code gets exactly that code, in that code's tier", () => {
    const single = rows.filter((r) => r.status === "done" && r.warnings.length === 1);
    expect(single.length).toBeGreaterThan(20);
    for (const r of single) {
      expect(r.warnings[0]!.code, r.name).toBe(r.expect);
      expect(r.next, r.name).toMatchObject({ code: r.expect, tier: r.layers[r.expect] });
    }
  });

  it("a done case's next has its expect code's tier, unless a validity warning outranks a drafting expect", () => {
    for (const r of rows.filter((x) => x.status === "done")) {
      const tier = r.layers[r.expect];
      if (tier === "drafting" && r.warnings.some((d) => r.layers[d.code!] !== "drafting"))
        expect(r.next?.tier, r.name).toBe("validity"); // the lead ruling: drafting never ahead of validity
      else expect(r.next?.tier, r.name).toBe(tier);
    }
  });

  it("every clean twin's next never names its case's expect code", () => {
    for (const s of DEFECT_SOURCES.filter((x) => x.name.endsWith(".clean.arch"))) {
      const twinOf = headerOf(s.src)["twin-of"]!;
      const c = cases.find((x) => x.name.endsWith(`/${twinOf}.arch`))!;
      const n = nextDiagnostic({ diagnostics: compile(s.src).diagnostics, lint: lint(s.src) });
      expect(n?.code ?? null, s.name).not.toBe(headerOf(c.src).expect);
    }
  });
});

describe("L1 · next is invisible", () => {
  const API: CompilerApi = { compile, describe: describePlan, lint };
  const opts = { world: TASTE_WORLD };
  // Every input next can take, over every example, IN THIS PROCESS, before the digests are read.
  for (const s of EXAMPLE_SOURCES) {
    const diagnostics = compile(s.src, opts).diagnostics;
    if (diagnostics.some((d) => d.severity === "error")) continue;
    nextDiagnostic({
      diagnostics,
      lint: lint(s.src, opts),
      profileLint: lint(s.src, { ...opts, profile: "accessibility-advisory" }),
      intent: validateIntent(s.src, { rooms: 2 }, opts),
      taste: taste(s.src, { profile: "generic", world: TASTE_WORLD }),
    });
  }
  const authorsHeight = new Set(AUTHORS_HEIGHT);
  for (const [name, sha] of BASELINE) {
    it(`examples/${name}.arch: every storey's SVG, describe() and lint() equal the pinned baseline`, () => {
      const src = EXAMPLE_SOURCES.find((s) => s.name === `examples/${name}.arch`)!.src;
      expect(allStoreysDigestWith(API, authorsHeight.has(name) ? heightFreeSource(src) : src, opts)).toBe(sha);
    });
  }
});
