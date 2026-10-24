/**
 * `taste(source, { profile?, world? })` — the taste layer (ADR 0032, plan-soundness PS5.1).
 *
 * A separate, sourced score in [0, 1] of how well a plan meets profile- and culture-dependent
 * quality criteria (privacy gradient, daylight, a common room at the heart). It is ADVICE: it
 * never gates, never sets an exit code, and neither `lint()` nor `describe()` ever reads it (an
 * import-graph law, `test/taste-invisible.test.ts`). Only plain defects are lint rules (D2).
 *
 * - **Coverage first.** A criterion that cannot judge says so (`assessable: false`, a reason)
 *   and is excluded, never counted as a pass; `coverage.weight` says how much was judged.
 * - **The validity cap.** The total is capped at 0.5 while default-ruleset `lint()` reports a
 *   warning from a VALIDITY-layer rule (`LintRule.layer`, read through
 *   `lintWithCoverage().layers`). Drafting-layer warnings (the annotation family) are listed in
 *   `validity.drafting` and never cap; compile-channel warnings never cap.
 * - **Exact.** Scores are integer permyriads decided in `BigInt` (`./arith.ts`) and printed by
 *   `fmtPermyriad`; the JSON numbers are the parse of those strings.
 * - **Bounded by counts.** One {@link TASTE_BUDGET} per call, charged before each criterion's
 *   work at its declared cost; a criterion that would exceed it is `taste-budget`, never a hang.
 *
 * Pure, sync, deterministic: it reads `describe()`, `lintWithCoverage()` and the resolved IR
 * through the shared parse/resolve memos and mutates none of them.
 */

import { resolvePlan } from "../analyze.js";
import { describe, type SceneSummary } from "../describe.js";
import type { ResolvedLevel, ResolvedPlan } from "../ir.js";
import { lintWithCoverage } from "../lint.js";
import { fmtPermyriad } from "../num-format.js";
import type { World } from "../world.js";
import { adviceOf } from "./advice.js";
import { meanPermyriad, ONE } from "./arith.js";
import { type CriterionResult, TASTE_CRITERIA, notJudged, type TasteProfile, type TasteStorey } from "./criteria.js";
import {
  MAX_EVIDENCE,
  TASTE_SUBSCORES,
  type TasteCriterion,
  type TasteReport,
  type TasteSkip,
  type TasteSubscore,
} from "./report.js";

export type {
  TasteAdvisory,
  TasteCriterion,
  TasteEvidence,
  TasteReport,
  TasteSkip,
  TasteSkipReason,
  TasteSubscore,
  TasteVerified,
} from "./report.js";
export { TASTE_SUBSCORES } from "./report.js";
export { TASTE_ADVICE, type TasteAdviceRow } from "./advice.js";

/** The taste profiles (PS5.1 ships `generic` only; PS5.2 adds the residential-advisory three). */
export const TASTE_PROFILES: Readonly<Record<string, TasteProfile>> = Object.freeze({
  generic: {
    // IRC R303.1: glazing at least 8 % of the floor area of a habitable room [S, prior-art.md §3].
    daylightTarget: { num: 8n, den: 100n },
  },
});

/** The names {@link taste} accepts, in a stable order. */
export const TASTE_PROFILE_NAMES: readonly string[] = Object.keys(TASTE_PROFILES);

/**
 * The counted budget of one `taste()` call, in criterion cost units (each criterion's declared
 * upper bound on its work: R3 public × bedroom rooms, R7 windows + rooms, R14 V·(V + E) on the
 * access graph). Set by measurement (PS5.1a): the largest charge over the examples, the defect
 * corpus and the taste corpus is 680 units (`examples/terrace-row.arch`; re-measured by
 * `test/taste-budget.test.ts`), and the budget, 1,000,000, is 1,470 times that (at least 1,000 times,
 * as the step budget was). A plan at the
 * 5,000-elements-per-storey cap (`MAX_ELEMENTS`) can exceed it: the criterion then reports
 * `taste-budget` instead of running.
 */
export const TASTE_BUDGET = 1_000_000;

export interface TasteOptions {
  /** A name from {@link TASTE_PROFILE_NAMES}; default `"generic"`. */
  profile?: string;
  /** How `import` resolves (the same seam as `compile()`). */
  world?: World;
}

/** A permyriad as the JSON number its exact decimal parses to. */
const num = (p: number): number => Number(fmtPermyriad(p));

/**
 * Score `source` under a taste profile. Never throws on user source: a plan that does not
 * resolve returns `ok: false` with nothing scored. An unknown `profile` is a caller error and
 * throws a `RangeError` naming the available profiles.
 */
export function taste(source: string, opts: TasteOptions = {}): TasteReport {
  return tasteWithBudget(source, opts, TASTE_BUDGET);
}

/** @internal {@link taste} under an explicit budget, so the `taste-budget` skip is testable. */
export function tasteWithBudget(source: string, opts: TasteOptions, budget: number): TasteReport {
  const profileName = opts.profile ?? "generic";
  const profile = TASTE_PROFILES[profileName];
  if (!profile)
    throw new RangeError(`unknown taste profile "${profileName}" (available: ${TASTE_PROFILE_NAMES.join(", ")})`);
  const world = opts.world ? { world: opts.world } : {};

  const { ir, levels } = resolvePlan(source, world);
  if (!ir) return emptyReport(profileName);

  const summary = describe(source, world);
  const linted = lintWithCoverage(source, world);
  const storeys = storeysOf(summary, ir, levels);

  // The validity cap: codes, never message text; the layer comes from the rule that declares it.
  const validityCodes: string[] = [];
  const draftingCodes: string[] = [];
  let validityWarnings = 0;
  let draftingWarnings = 0;
  for (const d of linted.diagnostics) {
    if (d.severity !== "warning" || d.code === undefined) continue;
    if (linted.layers[d.code] === "drafting") {
      draftingWarnings++;
      if (!draftingCodes.includes(d.code)) draftingCodes.push(d.code);
    } else {
      validityWarnings++;
      if (!validityCodes.includes(d.code)) validityCodes.push(d.code);
    }
  }
  const pass = validityWarnings === 0;

  let left = budget;
  const skipped: TasteSkip[] = [];
  const criteria: TasteCriterion[] = [];
  const perSubscore = new Map<TasteSubscore, Array<{ p: number; w: number }>>();
  let assessableWeight = 0;
  let totalWeight = 0;
  for (const def of TASTE_CRITERIA) {
    const row = adviceOf(def.id);
    totalWeight += def.weight;
    // Charged BEFORE the work: a criterion that would overspend the budget does not run.
    const cost = Math.max(1, def.cost(storeys));
    let result: CriterionResult;
    if (cost > left) {
      result = {
        reason: "taste-budget",
        measured: null,
        p: null,
        message: notJudged(def.id, "taste-budget"),
        evidence: [],
        skips: [],
      };
    } else {
      left -= cost;
      result = def.judge(storeys, profile);
    }
    skipped.push(...result.skips);
    if (result.reason) skipped.push({ criterion: def.id, reason: result.reason });
    const assessable = result.p !== null;
    if (assessable) {
      assessableWeight += def.weight;
      const list = perSubscore.get(row.subscore) ?? [];
      list.push({ p: result.p!, w: def.weight });
      perSubscore.set(row.subscore, list);
    }
    criteria.push({
      id: def.id,
      name: row.name,
      subscore: row.subscore,
      kind: "taste",
      weight: def.weight,
      assessable,
      ...(result.reason ? { reason: result.reason } : {}),
      measured: result.measured,
      score: result.p === null ? null : num(result.p),
      source: row.source,
      verified: row.verified,
      advice: result.p !== null && result.p < ONE ? row.code : null,
      message: result.message,
      evidence: result.evidence.slice(0, MAX_EVIDENCE),
      ...(result.evidence.length > MAX_EVIDENCE ? { evidence_more: result.evidence.length - MAX_EVIDENCE } : {}),
    });
  }

  // Criterion → subscore: weighted mean of permyriads. Subscore → total: each subscore that
  // judged anything weighs 1.
  const subP = new Map<TasteSubscore, number>();
  for (const k of TASTE_SUBSCORES) {
    const m = meanPermyriad(perSubscore.get(k) ?? []);
    if (m !== null) subP.set(k, m);
  }
  const uncappedP = meanPermyriad([...subP.values()].map((p) => ({ p, w: 1 })));
  const scoreP = uncappedP === null ? null : pass ? uncappedP : Math.min(uncappedP, ONE / 2);

  const roomCount = storeys.reduce((n, s) => n + s.summary.rooms.length, 0);
  const unclassified = linted.coverage?.unclassifiedRooms ?? [];
  return {
    profile: profileName,
    ok: true,
    score: scoreP === null ? null : num(scoreP),
    uncapped: uncappedP === null ? null : num(uncappedP),
    capped: scoreP !== null && !pass,
    validity: {
      pass,
      warnings: validityWarnings,
      codes: validityCodes,
      drafting: { warnings: draftingWarnings, codes: draftingCodes },
    },
    advisory: [],
    coverage: {
      rooms: roomCount,
      classified: roomCount - unclassified.length,
      unclassified,
      weight: { assessable: assessableWeight, total: totalWeight },
      skipped,
    },
    subscores: Object.fromEntries(TASTE_SUBSCORES.map((k) => [k, subP.has(k) ? num(subP.get(k)!) : null])) as Record<
      TasteSubscore,
      number | null
    >,
    criteria,
  };
}

/** One {@link TasteStorey} per storey: the lowest is judged by the depth readers, the rest are `upper`. */
function storeysOf(summary: SceneSummary, ir: ResolvedPlan, levels: readonly ResolvedLevel[]): TasteStorey[] {
  return levels.length > 0 && summary.levels
    ? summary.levels.map((l, i) => ({ level: l.level, summary: l, ir: levels[i]!.ir, upper: i > 0 }))
    : [{ summary, ir, upper: false }];
}

/**
 * @internal What one `taste()` call charges against {@link TASTE_BUDGET}, per criterion in
 * R-number order (each criterion's declared cost, at least 1); `[]` when the plan does not
 * resolve. The measurement {@link TASTE_BUDGET} was set from (`test/taste-budget.test.ts`).
 */
export function tasteCharges(source: string, opts: Pick<TasteOptions, "world"> = {}): number[] {
  const world = opts.world ? { world: opts.world } : {};
  const { ir, levels } = resolvePlan(source, world);
  if (!ir) return [];
  const storeys = storeysOf(describe(source, world), ir, levels);
  return TASTE_CRITERIA.map((def) => Math.max(1, def.cost(storeys)));
}

/** The report of a plan that does not resolve: nothing measured, nothing scored. */
function emptyReport(profile: string): TasteReport {
  return {
    profile,
    ok: false,
    score: null,
    uncapped: null,
    capped: false,
    validity: { pass: false, warnings: 0, codes: [], drafting: { warnings: 0, codes: [] } },
    advisory: [],
    coverage: {
      rooms: 0,
      classified: 0,
      unclassified: [],
      weight: { assessable: 0, total: TASTE_CRITERIA.reduce((n, c) => n + c.weight, 0) },
      skipped: [],
    },
    subscores: Object.fromEntries(TASTE_SUBSCORES.map((k) => [k, null])) as Record<TasteSubscore, number | null>,
    criteria: [],
  };
}
