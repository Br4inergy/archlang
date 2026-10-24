/**
 * The taste criteria of PS5.1a: R3 (intimacy gradient), R7 (daylight ratio) and R14 (common
 * area at the heart), as defined in `docs/plans/plan-soundness/research/2026-10-24-ps5-taste-design.md`
 * §3. Each reads `describe()` facts (what an agent sees) and, for window sizes and heights only,
 * the resolved IR; none reads an id or a label as meaning (uses come from
 * `describe().rooms[].uses`, which is `roomUses`). Pure, deterministic, integer arithmetic
 * (`./arith.ts`).
 *
 * A criterion is a COST and a judge. The cost is an upper bound on the judge's work, in the
 * units the judge counts on its {@link Work} counter (one unit per loop step: a room, a window,
 * an element, an edge, a pair, a BFS visit), charged against the call's counted budget BEFORE
 * the judge runs (design §2.4); `test/taste-budget.test.ts` holds work ≤ cost on a probe plan.
 * Every lookup the judge repeats goes through a map it builds once and counts. Evidence is
 * collected up to {@link MAX_EVIDENCE} entries and only counted past that. Rooms are named in
 * messages by label; ids go only in `evidence[].ids`.
 */

import { accessDigraph } from "../analyze.js";
import { WINDOW_HEAD, WINDOW_SILL } from "../datum.js";
import type { LevelSummary, SceneSummary } from "../describe.js";
import type { ResolvedPlan, RWindow } from "../ir.js";
import { fmtRatio, lattice, meanPermyriad, ONE, type Ratio, ramp } from "./arith.js";
import { adviceOf } from "./advice.js";
import { MAX_EVIDENCE, type TasteEvidence, type TasteSkip, type TasteSkipReason } from "./report.js";

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

/** The judge's work counter: one unit per counted loop step. */
export interface Work {
  n: number;
}

/** What one criterion found. `p` is a permyriad, `null` when not assessable. */
export interface CriterionResult {
  reason?: TasteSkipReason;
  measured: { num: number; den: number } | null;
  p: number | null;
  message: string;
  /** At most {@link MAX_EVIDENCE} entries. */
  evidence: TasteEvidence[];
  /** How many more evidence entries there were (counted, not collected). */
  evidenceMore: number;
  /** Storey- or room-level skips that did not stop the criterion (or did, with `reason`). */
  skips: TasteSkip[];
}

export interface TasteCriterionDef {
  id: string;
  weight: number;
  /** An upper bound on the work {@link judge} counts; charged before it runs. */
  cost(storeys: readonly TasteStorey[]): number;
  judge(storeys: readonly TasteStorey[], profile: TasteProfile, work: Work): CriterionResult;
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

/** Each room's name as a person reads it (its label, or its id when it has none: lint's rule),
 *  built once per storey: one unit per room. */
function namesOf(s: TasteStorey, work: Work): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of s.summary.rooms) {
    work.n++;
    out.set(r.id, `"${r.label ?? r.id}"`);
  }
  return out;
}

/** Evidence collected up to {@link MAX_EVIDENCE} entries and counted past that. */
class EvidenceList {
  readonly items: TasteEvidence[] = [];
  more = 0;
  add(s: TasteStorey, ids: string[], fact: string): void {
    if (this.items.length >= MAX_EVIDENCE) {
      this.more++;
      return;
    }
    this.items.push({ ids, fact, ...(s.level !== undefined ? { level: s.level } : {}) });
  }
}

/** The words a skip reason is explained by in a message. */
export const TASTE_SKIP_WHY: Readonly<Record<TasteSkipReason, string>> = {
  "no-entrance": "the plan has no way in",
  "too-few-items": "there is not enough to compare",
  "too-small": "the room's floor area rounds to 0 m²",
  "upper-storey": "upper storeys are not judged until their entrance depths are reliable",
  "taste-budget": "the call's counted taste budget is spent",
};

/** The message of a criterion that cannot judge. */
export function notJudged(id: string, reason: TasteSkipReason): string {
  return `Not judged: ${TASTE_SKIP_WHY[reason]}. The criterion asks for ${adviceOf(id).asks}.`;
}

function skipped(id: string, reason: TasteSkipReason, skips: TasteSkip[] = []): CriterionResult {
  return { reason, measured: null, p: null, message: notJudged(id, reason), evidence: [], evidenceMore: 0, skips };
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
 * Each room's door depth as `describe().access` reports it, built once per storey (one unit per
 * access node): from the MAIN entrance when the storey names one (PS0.10; `null` for a room
 * reached only through another way in), otherwise from the nearest entrance. `null` means not
 * reached.
 */
function depthsOf(s: TasteStorey, work: Work): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (const node of s.summary.access.rooms) {
    work.n++;
    out.set(node.id, "depthFromMainEntrance" in node ? (node.depthFromMainEntrance ?? null) : node.depthFromEntrance);
  }
  return out;
}

// ---------------------------------------------------------------------------
// R3 · intimacy gradient (zoning)
// ---------------------------------------------------------------------------

const R3: TasteCriterionDef = {
  id: "R3",
  weight: 1,
  // names (V) + depths (access nodes) + the use scan (V) + the pairs (P·B), per judged storey.
  cost: (storeys) =>
    storeys
      .filter((s) => !s.upper)
      .reduce((n, s) => {
        const rooms = s.summary.rooms;
        const pub = rooms.filter((r) => isPublic(r.uses)).length;
        const bed = rooms.filter((r) => isBedroomOnly(r.uses)).length;
        return n + 2 * rooms.length + s.summary.access.rooms.length + pub * bed;
      }, 1),
  judge(storeys, _profile, work) {
    const { judged, skips } = groundStoreys("R3", storeys);
    let pairs = 0;
    let inversions = 0;
    let anyEntrance = false;
    const evidence = new EvidenceList();
    let first: { names: Map<string, string>; p: string; dp: number; b: string; db: number } | null = null;
    for (const s of judged) {
      if (!s.summary.access.hasEntrance) continue;
      anyEntrance = true;
      const names = namesOf(s, work);
      const depth = depthsOf(s, work);
      const pubs: Array<{ id: string; d: number }> = [];
      const beds: Array<{ id: string; d: number }> = [];
      for (const r of s.summary.rooms) {
        work.n++;
        const d = depth.get(r.id) ?? null;
        if (d === null) continue;
        if (isPublic(r.uses)) pubs.push({ id: r.id, d });
        else if (isBedroomOnly(r.uses)) beds.push({ id: r.id, d });
      }
      for (const p of pubs) {
        for (const b of beds) {
          work.n++;
          pairs++;
          // Equal depth is no inversion: two rooms off one hall is the ideal.
          if (p.d > b.d) {
            inversions++;
            evidence.add(s, [p.id, b.id], `depth ${p.d} > depth ${b.d}`);
            first ??= { names, p: p.id, dp: p.d, b: b.id, db: b.d };
          }
        }
      }
    }
    if (!anyEntrance) return skipped("R3", judged.length === 0 ? "upper-storey" : "no-entrance", skips);
    if (pairs === 0) return skipped("R3", "too-few-items", skips);
    const good = pairs - inversions;
    const p = ramp({ num: BigInt(good), den: BigInt(pairs) }, { num: 0n, den: 1n }, { num: 1n, den: 1n });
    const message = first
      ? `${first.names.get(first.p)} is ${first.dp} doors in from the entrance and ${first.names.get(first.b)} ${first.db}: ` +
        `${inversions} of ${pairs} living-to-bedroom pair${pairs === 1 ? "" : "s"} ${inversions === 1 ? "puts" : "put"} the public room deeper than the bedroom.`
      : `No living, dining or kitchen room is deeper from the entrance than a bedroom (${pairs} pair${pairs === 1 ? "" : "s"}).`;
    return {
      measured: { num: good, den: pairs },
      p,
      message,
      evidence: evidence.items,
      evidenceMore: evidence.more,
      skips,
    };
  },
};

// ---------------------------------------------------------------------------
// R7 · daylight ratio (light)
// ---------------------------------------------------------------------------

/** One window as R7 reads it: its id and its resolved width, sill and head. */
interface Glazing {
  id: string;
  el: RWindow;
}

/**
 * The windows serving each room, built once per storey: one unit per IR element (to find the
 * windows) and one per `describe()` window (to attribute it). `describe().windows` is the IR's
 * windows in order, one for one (`summarizeResolved`); a window whose id does not pair is left
 * out rather than guessed.
 */
function windowsByRoom(s: TasteStorey, work: Work): Map<string, Glazing[]> {
  const irWindows: RWindow[] = [];
  for (const e of s.ir.elements) {
    work.n++;
    if (e.kind === "window") irWindows.push(e as RWindow);
  }
  const out = new Map<string, Glazing[]>();
  s.summary.windows.forEach((w, i) => {
    work.n++;
    const el = irWindows[i];
    if (w.room === null || el === undefined || el.id !== w.id) return;
    const list = out.get(w.room) ?? [];
    list.push({ id: w.id, el });
    out.set(w.room, list);
  });
  return out;
}

const R7: TasteCriterionDef = {
  id: "R7",
  weight: 1,
  // names (V) + the IR elements (E) + the window index (W) + the rooms (V) + each room's own
  // windows (at most W in all), per storey.
  cost: (storeys) =>
    storeys.reduce((n, s) => n + 2 * s.summary.rooms.length + s.ir.elements.length + 2 * s.summary.windows.length, 1),
  judge(storeys, profile, work) {
    const target = profile.daylightTarget;
    const pct = `${fmtRatio(target.num * 100n, target.den, 2)} %`;
    const items: number[] = [];
    const skips: TasteSkip[] = [];
    let meeting = 0;
    let worst: { names: Map<string, string>; id: string; v: Ratio } | null = null;
    const evidence = new EvidenceList();
    for (const s of storeys) {
      const names = namesOf(s, work);
      const byRoom = windowsByRoom(s, work);
      for (const r of s.summary.rooms) {
        work.n++;
        if (!isHabitable(r.uses)) continue;
        const net = r.net_area_m2 !== undefined;
        // A centi-square-metre integer: `describe()` prints areas to 2 decimals, so this is exact.
        const aC = BigInt(Math.round((net ? r.net_area_m2! : r.area_m2) * 100));
        if (aC <= 0n) {
          skips.push({
            criterion: "R7",
            reason: "too-small",
            room: r.id,
            ...(s.level !== undefined ? { level: s.level } : {}),
          });
          continue;
        }
        const own = byRoom.get(r.id) ?? [];
        let g = 0n;
        // "heights default" when every window of THIS room stands at the default 900/2100 datum.
        let defaults = own.length > 0;
        for (const { el } of own) {
          work.n++;
          g += lattice(el.width) * (lattice(el.head) - lattice(el.sill));
          if (el.sill !== WINDOW_SILL || el.head !== WINDOW_HEAD) defaults = false;
        }
        // v = G / A with G in mm²·10⁶ and A in m²/100 = mm²·10⁴: v = g / (aC · 10¹⁰).
        const v: Ratio = { num: g, den: aC * 10n ** 10n };
        const p = ramp(v, { num: 0n, den: 1n }, target);
        items.push(p);
        if (p === ONE) meeting++;
        if (worst === null || v.num * worst.v.den < worst.v.num * v.den) worst = { names, id: r.id, v };
        evidence.add(
          s,
          [r.id, ...own.map((w) => w.id)],
          `glazing ${fmtRatio(g, 10n ** 12n, 2)} m² / ${net ? "net" : "centreline"} floor ${fmtRatio(aC, 100n, 2)} m² = ` +
            `${fmtRatio(v.num, v.den, 4)} (target ${fmtRatio(target.num, target.den, 4)})${defaults ? "; heights default" : ""}`,
        );
      }
    }
    if (items.length === 0) return skipped("R7", "too-few-items", skips);
    const p = meanPermyriad(items.map((x) => ({ p: x, w: 1 })))!;
    const n = items.length;
    const message =
      meeting === n
        ? `${n === 1 ? "The habitable room has" : `All ${n} habitable rooms have`} glazing of at least ${pct} of the floor area.`
        : `${meeting} of ${n} habitable room${n === 1 ? "" : "s"} ${meeting === 1 || n === 1 ? "reaches" : "reach"} glazing of ${pct} of the floor area; ` +
          `${worst!.names.get(worst!.id)} has ${fmtRatio(worst!.v.num * 100n, worst!.v.den, 2)} %.`;
    return {
      measured: { num: meeting, den: n },
      p,
      message,
      evidence: evidence.items,
      evidenceMore: evidence.more,
      skips,
    };
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
 * D_k per storey), with no `log2`. Work: E for the graph, V + 2E for the neighbour lists, V for
 * the system, then V + 2E per system room's breadth-first walk.
 */
function totalDepths(s: TasteStorey, work: Work): Map<string, number> {
  const access = s.summary.access;
  work.n += access.edges.length;
  const g = accessDigraph(
    access.rooms.map((r) => r.id),
    access.edges,
  );
  const nbrs = new Map<string, string[]>();
  for (const n of g.nodes) {
    const out = g.out(n);
    work.n += 1 + out.length;
    nbrs.set(n, [...new Set(out.map((e) => e.to))]);
  }
  const system: string[] = [];
  for (const r of access.rooms) {
    work.n++;
    if (r.depthFromEntrance !== null) system.push(r.id);
  }
  const out = new Map<string, number>();
  for (const id of system) {
    const dist = new Map<string, number>([[id, 0]]);
    const queue = [id];
    for (let i = 0; i < queue.length; i++) {
      const n = queue[i]!;
      const next = nbrs.get(n) ?? [];
      work.n += 1 + next.length;
      for (const m of next) {
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
  // names (V) + the graph and walks ((V + 2)·(V + 1 + 2E) bounds E + (V + 1 + 2E) + V + V·(V + 1
  // + 2E)) + the ranks (V²) + the common-room scan (V), on the one judged storey.
  cost: (storeys) => {
    const s = storeys.find((x) => !x.upper);
    if (!s) return 1;
    const v = s.summary.access.rooms.length;
    const e = s.summary.access.edges.length;
    return 1 + 2 * s.summary.rooms.length + (v + 2) * (v + 1 + 2 * e) + v * v;
  },
  judge(storeys, _profile, work) {
    const { judged, skips } = groundStoreys("R14", storeys);
    if (judged.length === 0) return skipped("R14", "upper-storey", skips);
    // PS5.1a judges one storey (the lowest); a single-storey plan is that storey.
    const s = judged[0]!;
    if (!s.summary.access.hasEntrance) return skipped("R14", "no-entrance", skips);
    const t = totalDepths(s, work);
    const n = t.size;
    if (n < 3) return skipped("R14", "too-few-items", skips);
    // Rank 1 = the smallest T; ties share the better rank. One pass over the others per room.
    const rank = new Map<string, number>();
    for (const [id, ti] of t) {
      let r = 1;
      for (const v of t.values()) {
        work.n++;
        if (v < ti) r++;
      }
      rank.set(id, r);
    }
    const names = namesOf(s, work);
    let best: { id: string; r: number } | null = null;
    for (const room of s.summary.rooms) {
      work.n++;
      const r = rank.get(room.id);
      if (!isCommon(room.uses) || r === undefined) continue;
      if (best === null || r < best.r) best = { id: room.id, r };
    }
    if (best === null) return skipped("R14", "too-few-items", skips);
    const c = Math.ceil(n / 3);
    // 1 at rank ⌈n/3⌉ or better, linear to 0 at rank n.
    const p =
      best.r <= c
        ? ONE
        : ramp({ num: BigInt(best.r), den: 1n }, { num: BigInt(n), den: 1n }, { num: BigInt(c), den: 1n });
    const evidence = new EvidenceList();
    evidence.add(s, [best.id], `total depth ${t.get(best.id)}, rank ${best.r} of ${n}`);
    const heart = [...rank].filter(([, r]) => r === 1).map(([id]) => id);
    if (best.r > 1) evidence.add(s, heart, `total depth ${t.get(heart[0]!)}, rank 1 of ${n}`);
    // At most three rooms are named; the rest are counted.
    const named = heart.slice(0, 3).map((id) => names.get(id));
    const others = heart.length > 3 ? ` and ${heart.length - 3} more` : "";
    const message =
      best.r <= c
        ? `${names.get(best.id)} ranks ${best.r} of ${n} rooms by total depth to every other space: at the heart of the plan.`
        : `${names.get(best.id)} ranks ${best.r} of ${n} rooms by total depth to every other space; ` +
          `${named.join(" and ")}${others} ${heart.length === 1 ? "ranks" : "rank"} 1.`;
    return {
      measured: { num: best.r, den: n },
      p,
      message,
      evidence: evidence.items,
      evidenceMore: evidence.more,
      skips,
    };
  },
};

/** The criteria of PS5.1a, in R-number order. */
export const TASTE_CRITERIA: readonly TasteCriterionDef[] = [R3, R7, R14];
