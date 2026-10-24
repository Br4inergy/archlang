/**
 * The taste criteria of PS5.1a: R3 (intimacy gradient), R7 (daylight ratio) and R14 (common
 * area at the heart), as defined in `docs/plans/plan-soundness/research/2026-10-24-ps5-taste-design.md`
 * §3. Each reads `describe()` facts (what an agent sees) and, for window heights only, the
 * resolved IR; none reads an id or a label as meaning (uses come from `describe().rooms[].uses`,
 * which is `roomUses`). Pure, deterministic, integer arithmetic (`./arith.ts`).
 *
 * A criterion is a cost (charged against the call's counted budget BEFORE its work, design
 * §2.4) and a judge. Rooms are named in messages by label; ids go only in `evidence[].ids`.
 */

import { accessDigraph } from "../analyze.js";
import type { LevelSummary, SceneSummary } from "../describe.js";
import type { ResolvedPlan, RWindow } from "../ir.js";
import { fmtRatio, lattice, meanPermyriad, ONE, type Ratio, ramp } from "./arith.js";
import { adviceOf } from "./advice.js";
import type { TasteEvidence, TasteSkip, TasteSkipReason } from "./report.js";

/** One storey as taste reads it: its `describe()` summary and its resolved IR. */
export interface TasteStorey {
  /** The authored level, on a multi-storey plan only. */
  level?: number;
  summary: SceneSummary | LevelSummary;
  ir: ResolvedPlan;
  /** Not the lowest storey of a multi-storey plan (its depths wait for PS0.3). */
  upper: boolean;
}

/** A profile's taste numbers (PS5.2 adds `cn-`, `uk-`, `us-residential-advisory`). */
export interface TasteProfile {
  /** R7's target glazing-to-floor ratio (generic: 8 %, IRC R303.1 [S]). */
  daylightTarget: Ratio;
}

/** What one criterion found. `p` is a permyriad, `null` when not assessable. */
export interface CriterionResult {
  reason?: TasteSkipReason;
  measured: { num: number; den: number } | null;
  p: number | null;
  message: string;
  evidence: TasteEvidence[];
  /** Storey-level skips that did not stop the criterion (or did, with `reason`). */
  skips: TasteSkip[];
}

export interface TasteCriterionDef {
  id: string;
  weight: number;
  /** An upper bound on the work, in counted steps; charged before {@link judge} runs. */
  cost(storeys: readonly TasteStorey[]): number;
  judge(storeys: readonly TasteStorey[], profile: TasteProfile): CriterionResult;
}

// ---------------------------------------------------------------------------
// Shared readings
// ---------------------------------------------------------------------------

const PUBLIC_USES = new Set(["living", "dining", "kitchen"]);
const HABITABLE_USES = new Set(["living", "dining", "kitchen", "bedroom", "office"]);
const COMMON_USES = new Set(["living", "dining"]);

/** A public room: living, dining or kitchen use (`privacy.ts`'s "public"). */
const isPublic = (uses: readonly string[]): boolean => uses.some((u) => PUBLIC_USES.has(u));
/** A bedroom: bedroom use and no public use (`privacy.ts`'s "private" bedroom test). */
const isBedroomOnly = (uses: readonly string[]): boolean => uses.includes("bedroom") && !isPublic(uses);
const isHabitable = (uses: readonly string[]): boolean => uses.some((u) => HABITABLE_USES.has(u));
const isCommon = (uses: readonly string[]): boolean => uses.some((u) => COMMON_USES.has(u));

/** A room's name as a person reads it: its label, or its id when it has none (lint's rule). */
function nameOf(s: TasteStorey, id: string): string {
  const r = s.summary.rooms.find((x) => x.id === id);
  return `"${r?.label ?? id}"`;
}

/** Evidence with the storey's level attached on a multi-storey plan. */
function ev(s: TasteStorey, ids: string[], fact: string): TasteEvidence {
  return { ids, fact, ...(s.level !== undefined ? { level: s.level } : {}) };
}

/** The words a skip reason is explained by in a message. */
export const TASTE_SKIP_WHY: Readonly<Record<TasteSkipReason, string>> = {
  "no-entrance": "the plan has no way in",
  "too-few-items": "there is not enough to compare",
  "upper-storey": "upper storeys are not judged until their entrance depths are reliable",
  "taste-budget": "the call's counted taste budget is spent",
};

/** The message of a criterion that cannot judge. */
export function notJudged(id: string, reason: TasteSkipReason): string {
  return `Not judged: ${TASTE_SKIP_WHY[reason]}. The criterion asks for ${adviceOf(id).asks}.`;
}

function skipped(id: string, reason: TasteSkipReason, skips: TasteSkip[] = []): CriterionResult {
  return { reason, measured: null, p: null, message: notJudged(id, reason), evidence: [], skips };
}

/** The storeys a depth-reading criterion judges, and the upper ones it files as skipped. */
function groundStoreys(id: string, storeys: readonly TasteStorey[]): { judged: TasteStorey[]; skips: TasteSkip[] } {
  const judged = storeys.filter((s) => !s.upper);
  const skips: TasteSkip[] = storeys
    .filter((s) => s.upper)
    .map((s) => ({ criterion: id, reason: "upper-storey", ...(s.level !== undefined ? { level: s.level } : {}) }));
  return { judged, skips };
}

/**
 * A room's door depth as `describe().access` reports it: from the MAIN entrance when the storey
 * names one (PS0.10; `null` for a room reached only through another way in), otherwise from the
 * nearest entrance. `null` means not reached.
 */
function depthOf(s: TasteStorey, id: string): number | null {
  const node = s.summary.access.rooms.find((r) => r.id === id);
  if (!node) return null;
  if ("depthFromMainEntrance" in node) return node.depthFromMainEntrance ?? null;
  return node.depthFromEntrance;
}

// ---------------------------------------------------------------------------
// R3 · intimacy gradient (zoning)
// ---------------------------------------------------------------------------

const R3: TasteCriterionDef = {
  id: "R3",
  weight: 1,
  cost: (storeys) =>
    storeys
      .filter((s) => !s.upper)
      .reduce((n, s) => {
        const pub = s.summary.rooms.filter((r) => isPublic(r.uses)).length;
        const bed = s.summary.rooms.filter((r) => isBedroomOnly(r.uses)).length;
        return n + Math.max(1, pub * bed);
      }, 0),
  judge(storeys) {
    const { judged, skips } = groundStoreys("R3", storeys);
    let pairs = 0;
    let inversions = 0;
    let anyEntrance = false;
    const evidence: TasteEvidence[] = [];
    let first: { s: TasteStorey; p: string; dp: number; b: string; db: number } | null = null;
    for (const s of judged) {
      if (!s.summary.access.hasEntrance) continue;
      anyEntrance = true;
      const rooms = s.summary.rooms;
      for (const p of rooms) {
        if (!isPublic(p.uses)) continue;
        const dp = depthOf(s, p.id);
        if (dp === null) continue;
        for (const b of rooms) {
          if (!isBedroomOnly(b.uses)) continue;
          const db = depthOf(s, b.id);
          if (db === null) continue;
          pairs++;
          // Equal depth is no inversion: two rooms off one hall is the ideal.
          if (dp > db) {
            inversions++;
            evidence.push(ev(s, [p.id, b.id], `depth ${dp} > depth ${db}`));
            first ??= { s, p: p.id, dp, b: b.id, db };
          }
        }
      }
    }
    if (!anyEntrance) return skipped("R3", judged.length === 0 ? "upper-storey" : "no-entrance", skips);
    if (pairs === 0) return skipped("R3", "too-few-items", skips);
    const good = pairs - inversions;
    const p = ramp({ num: BigInt(good), den: BigInt(pairs) }, { num: 0n, den: 1n }, { num: 1n, den: 1n });
    const message = first
      ? `${nameOf(first.s, first.p)} is ${first.dp} doors in from the entrance and ${nameOf(first.s, first.b)} ${first.db}: ` +
        `${inversions} of ${pairs} living-to-bedroom pair${pairs === 1 ? "" : "s"} ${inversions === 1 ? "puts" : "put"} the public room deeper than the bedroom.`
      : `No living, dining or kitchen room is deeper from the entrance than a bedroom (${pairs} pair${pairs === 1 ? "" : "s"}).`;
    return { measured: { num: good, den: pairs }, p, message, evidence, skips };
  },
};

// ---------------------------------------------------------------------------
// R7 · daylight ratio (light)
// ---------------------------------------------------------------------------

/** Glazing area in lattice units (mm² × 10⁶) of the windows serving one room, with their ids. */
function glazingOf(s: TasteStorey, roomId: string): { g: bigint; ids: string[] } {
  const irWindows = s.ir.elements.filter((e): e is RWindow => e.kind === "window");
  let g = 0n;
  const ids: string[] = [];
  s.summary.windows.forEach((w, i) => {
    if (w.room !== roomId) return;
    // `describe().windows` is the IR's windows, in order, one for one (`summarizeResolved`);
    // the id lookup is a fallback that never runs on a plan the pairing holds for.
    const el = irWindows[i]?.id === w.id ? irWindows[i] : irWindows.find((x) => x.id === w.id);
    if (!el) return;
    g += lattice(el.width) * (lattice(el.head) - lattice(el.sill));
    ids.push(w.id);
  });
  return { g, ids };
}

const R7: TasteCriterionDef = {
  id: "R7",
  weight: 1,
  cost: (storeys) => storeys.reduce((n, s) => n + s.summary.windows.length + s.summary.rooms.length + 1, 0),
  judge(storeys, profile) {
    const target = profile.daylightTarget;
    const pct = `${fmtRatio(target.num * 100n, target.den, 2)} %`;
    const items: number[] = [];
    let meeting = 0;
    let worst: { s: TasteStorey; id: string; v: Ratio } | null = null;
    const evidence: TasteEvidence[] = [];
    for (const s of storeys) {
      const authored = s.summary.windows.some((w) => w.sill !== undefined || w.head !== undefined);
      for (const r of s.summary.rooms) {
        if (!isHabitable(r.uses)) continue;
        const net = r.net_area_m2 !== undefined;
        // A centi-square-metre integer: `describe()` prints areas to 2 decimals, so this is exact.
        const aC = BigInt(Math.round((net ? r.net_area_m2! : r.area_m2) * 100));
        if (aC <= 0n) continue;
        const { g, ids } = glazingOf(s, r.id);
        // v = G / A with G in mm²·10⁶ and A in m²/100 = mm²·10⁴: v = g / (aC · 10¹⁰).
        const v: Ratio = { num: g, den: aC * 10n ** 10n };
        const p = ramp(v, { num: 0n, den: 1n }, target);
        items.push(p);
        if (p === ONE) meeting++;
        if (worst === null || v.num * worst.v.den < worst.v.num * v.den) worst = { s, id: r.id, v };
        evidence.push(
          ev(
            s,
            [r.id, ...ids],
            `glazing ${fmtRatio(g, 10n ** 12n, 2)} m² / ${net ? "net" : "centreline"} floor ${fmtRatio(aC, 100n, 2)} m² = ` +
              `${fmtRatio(v.num, v.den, 4)} (target ${fmtRatio(target.num, target.den, 4)})${authored ? "" : "; heights default"}`,
          ),
        );
      }
    }
    if (items.length === 0) return skipped("R7", "too-few-items");
    const p = meanPermyriad(items.map((x) => ({ p: x, w: 1 })))!;
    const n = items.length;
    const message =
      meeting === n
        ? `${n === 1 ? "The habitable room has" : `All ${n} habitable rooms have`} glazing of at least ${pct} of the floor area.`
        : `${meeting} of ${n} habitable room${n === 1 ? "" : "s"} ${meeting === 1 || n === 1 ? "reaches" : "reach"} glazing of ${pct} of the floor area; ` +
          `${nameOf(worst!.s, worst!.id)} has ${fmtRatio(worst!.v.num * 100n, worst!.v.den, 2)} %.`;
    return { measured: { num: meeting, den: n }, p, message, evidence, skips: [] };
  },
};

// ---------------------------------------------------------------------------
// R14 · common area at the heart (circulation)
// ---------------------------------------------------------------------------

/**
 * Each system room's integer TOTAL DEPTH T: the sum of step distances to every other node of
 * the system (the component of `exterior`, the carrier included), on the simple access graph
 * `describe --facts syntax` reads (`accessDigraph`, an ambiguous connector joining nothing).
 * Within one storey, ranking by T is ranking by RRA (RRA = 2(T/(k−1) − 1)/((k−2)·D_k), one
 * D_k per storey), with no `log2`.
 */
function totalDepths(s: TasteStorey): Map<string, number> {
  const access = s.summary.access;
  const g = accessDigraph(
    access.rooms.map((r) => r.id),
    access.edges,
  );
  const nbrs = new Map<string, string[]>();
  for (const n of g.nodes) nbrs.set(n, [...new Set(g.out(n).map((e) => e.to))]);
  const system = access.rooms.filter((r) => r.depthFromEntrance !== null).map((r) => r.id);
  const out = new Map<string, number>();
  for (const id of system) {
    const dist = new Map<string, number>([[id, 0]]);
    const queue = [id];
    for (let i = 0; i < queue.length; i++) {
      const n = queue[i]!;
      for (const m of nbrs.get(n) ?? []) {
        if (dist.has(m)) continue;
        dist.set(m, dist.get(n)! + 1);
        queue.push(m);
      }
    }
    let t = 0;
    for (const d of dist.values()) t += d;
    out.set(id, t);
  }
  return out;
}

const R14: TasteCriterionDef = {
  id: "R14",
  weight: 1,
  cost: (storeys) =>
    storeys
      .filter((s) => !s.upper)
      .reduce((n, s) => {
        const v = s.summary.access.rooms.length + 1;
        return n + v * (v + s.summary.access.edges.length);
      }, 0),
  judge(storeys) {
    const { judged, skips } = groundStoreys("R14", storeys);
    if (judged.length === 0) return skipped("R14", "upper-storey", skips);
    // PS5.1a judges one storey (the lowest); a single-storey plan is that storey.
    const s = judged[0]!;
    if (!s.summary.access.hasEntrance) return skipped("R14", "no-entrance", skips);
    const t = totalDepths(s);
    const n = t.size;
    if (n < 3) return skipped("R14", "too-few-items", skips);
    const rankOf = (id: string): number => {
      const ti = t.get(id)!;
      let r = 1;
      for (const v of t.values()) if (v < ti) r++;
      return r;
    };
    let best: { id: string; r: number } | null = null;
    for (const room of s.summary.rooms) {
      if (!isCommon(room.uses) || !t.has(room.id)) continue;
      const r = rankOf(room.id);
      if (best === null || r < best.r) best = { id: room.id, r };
    }
    if (best === null) return skipped("R14", "too-few-items", skips);
    const c = Math.ceil(n / 3);
    // 1 at rank ⌈n/3⌉ or better, linear to 0 at rank n.
    const p =
      best.r <= c
        ? ONE
        : ramp({ num: BigInt(best.r), den: 1n }, { num: BigInt(n), den: 1n }, { num: BigInt(c), den: 1n });
    const evidence: TasteEvidence[] = [ev(s, [best.id], `total depth ${t.get(best.id)}, rank ${best.r} of ${n}`)];
    const heart = [...t.keys()].filter((id) => rankOf(id) === 1);
    if (best.r > 1) evidence.push(ev(s, heart, `total depth ${t.get(heart[0]!)}, rank 1 of ${n}`));
    const message =
      best.r <= c
        ? `${nameOf(s, best.id)} ranks ${best.r} of ${n} rooms by total depth to every other space: at the heart of the plan.`
        : `${nameOf(s, best.id)} ranks ${best.r} of ${n} rooms by total depth to every other space; ` +
          `${heart.map((id) => nameOf(s, id)).join(" and ")} ${heart.length === 1 ? "ranks" : "rank"} 1.`;
    return { measured: { num: best.r, den: n }, p, message, evidence, skips };
  },
};

/** The criteria of PS5.1a, in R-number order. */
export const TASTE_CRITERIA: readonly TasteCriterionDef[] = [R3, R7, R14];
