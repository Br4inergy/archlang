/**
 * Circulation quality as advisory warnings, built on the circulation nav-grid facts
 * (ADR 0008): a walk that squeezes below a passable width (`W_PATH_TOO_NARROW`), or
 * that wanders far from a straight line (`W_CIRCUITOUS_PATH`). Facts → advisory only,
 * never a layout change (ADR 0005/0006).
 *
 * `W_PATH_TOO_NARROW`'s domain is every room the modeled doors reach — **not** the rooms
 * the model happened to produce a measurement for. The distinction matters: a
 * sealed room has no `circulation.rooms[]` entry, so a rule that iterated that array would
 * go quiet exactly when the plan got worse — deepening one cabinet would take a plan from
 * "squeezes to 300 mm" to CLEAN. A
 * blocked route is the limit case of a narrow one — 0 mm of clear width — so it is the
 * same code, and `circulation.blocked` is what carries it — with the width of the best
 * way in MEASURED rather than printed as a zero, because a fabricated 0 mm is the same
 * defect 5.8 was filed over, one digit smaller.
 *
 * Both rules read the same circulation model, so it is built once per `lint()` run and
 * memoised on the (per-run) LintContext identity.
 */

import { type CirculationModel, computeCirculation, roomBottlenecks } from "../../analyze/circulation.js";
import { type AccessEdge, buildDoorAccessGraph, EXTERIOR_NODE } from "../../analyze.js";
import type { Diagnostic } from "../../diagnostics.js";
import type { LintContext, LintRule } from "../context.js";
import { mm, shortfall } from "../measure.js";
import { passableDoorWidthMm } from "./doors.js";

const modelCache = new WeakMap<LintContext, CirculationModel | null>();

function circulationOf(ctx: LintContext): CirculationModel | null {
  if (modelCache.has(ctx)) return modelCache.get(ctx) ?? null;
  const model = computeCirculation(
    ctx.rooms,
    ctx.ir.walls,
    ctx.doors,
    ctx.openings,
    ctx.furniture,
    ctx.access(),
    ctx.rules.tolMm,
    undefined,
    ctx.verticals,
    ctx.voids,
    // A storey with no front door is walked from the shafts that arrive on it, so these
    // rules measure it instead of going silent while reachability already treats those
    // landings as the storey's way in.
    ctx.building.arrivalShafts,
  );
  modelCache.set(ctx, model);
  return model;
}

/**
 * The closed remedy set for `W_PATH_TOO_NARROW`, sized against the ruleset minimum.
 *
 * None of these is a machine-applicable fix: widening a door rewrites a width the author
 * chose. When doors set the limit the hints name each one and the `width` that, applied to
 * every named door, was re-measured to clear the minimum ({@link attributeBottlenecks});
 * otherwise the bottleneck is a nav-grid CELL the model cannot attribute to one element. `arch repair` is deliberately not named; it clears wall
 * intrusions, swings, doorway landings and overlaps, not a route pinch, and pointing at a
 * tool that would report "nothing to do" is worse than silence.
 */
const narrowHints = (min: number, doors: readonly AccessEdge[] | null, ctx: LintContext): string[] =>
  doors === null
    ? [
        `Widen the tightest door/opening on the way to at least ${mm(min)} mm.`,
        `Or move the furniture pinching the route so ${mm(min)} mm of clear width survives.`,
        "Or add a second way in (another door or a leafless `opening`) so the pinch is avoidable.",
      ]
    : [
        ...doors.map(
          (e) =>
            `Widen ${e.kind} "${e.doorId}" to \`width ${mm(clearingWidth(e, ctx))}\` (now ${mm(e.nominalWidth)})${doors.length > 1 ? "" : `, which lets the walk clear the ${mm(min)} mm minimum`}.`,
        ),
        // A set is what was measured; that it needs every member is not claimed.
        ...(doors.length > 1 ? [`With these widened together the walk clears the ${mm(min)} mm minimum.`] : []),
        "Or add a second way in (another door or a leafless `opening`) so the pinch is avoidable.",
      ];

/**
 * The narrowest width, on the plan's `grid` module, at which this connector stops being a
 * pinch: a door must also clear `W_DOOR_CLEARANCE` ({@link passableDoorWidthMm}, the same
 * number the swing rule's narrowing hint is bounded by); an opening keeps its whole width.
 * Rounded UP to the module because the resolver snaps a written width to it.
 */
function clearingWidth(e: AccessEdge, ctx: LintContext): number {
  const need = e.kind === "door" ? passableDoorWidthMm(ctx.rules) : Math.ceil(ctx.rules.minPathClearWidthMm);
  const grid = ctx.ir.grid;
  return grid > 0 ? Math.ceil(need / grid) * grid : need;
}

/**
 * The door PATH a room's walk is attributed to (entrance first), or `null`. Never quoted on its
 * own: {@link attributeBottlenecks} takes candidate sets from it and verifies them first.
 *
 * Built on the DOOR graph: rooms joined by their connectors, each weighted by its clear width,
 * walked from exactly the sources the circulation model walks from (the exterior through the
 * front doors; ONLY on a storey with no front door, the rooms its shafts arrive in, at their
 * own measured width: `computeCirculation`'s `viaShaft`). A widest-path search gives each
 * room a door-only capacity and one path to it; ties keep the first label settled, so the path
 * is deterministic but not guaranteed to have the fewest doors (ranking by width then door
 * count is not isotone, `src/algebra/semiring.ts`). The path is returned only when:
 *   - the room's reading equals its door capacity (otherwise furniture inside it sets it), and
 *   - every room the path passes through either reads its own door capacity or reads wider
 *     than this room (otherwise furniture in a room on the way could be the pinch).
 */
function bottleneckDoors(
  ctx: LintContext,
  widthOf: ReadonlyMap<string, number>,
  edges: readonly AccessEdge[],
): (roomId: string) => AccessEdge[] | null {
  const order = new Map<string, number>([
    [EXTERIOR_NODE, -1],
    ...ctx.rooms.map((r, i) => [r.id, i] as [string, number]),
  ]);
  const cap = new Map<string, number>();
  const hops = new Map<string, number>();
  const via = new Map<string, AccessEdge>();
  const prev = new Map<string, string>();
  if (edges.some((e) => e.between.includes(EXTERIOR_NODE))) {
    cap.set(EXTERIOR_NODE, Number.POSITIVE_INFINITY);
    hops.set(EXTERIOR_NODE, 0);
  }
  // Arrival rooms are a source only where the circulation model makes them one.
  for (const id of ctx.access().hasEntrance ? [] : ctx.building.arrivalRooms) {
    const w = widthOf.get(id);
    if (w !== undefined && !cap.has(id)) {
      cap.set(id, w);
      hops.set(id, 0);
    }
  }
  const done = new Set<string>();
  for (;;) {
    let u: string | null = null;
    for (const [n, c] of cap) {
      if (done.has(n)) continue;
      if (
        u === null ||
        c > cap.get(u)! ||
        (c === cap.get(u)! &&
          (hops.get(n)! < hops.get(u)! || (hops.get(n) === hops.get(u) && (order.get(n) ?? 0) < (order.get(u) ?? 0))))
      )
        u = n;
    }
    if (u === null) break;
    done.add(u);
    for (const e of edges) {
      if (!e.between.includes(u)) continue;
      const v: string = e.between[0] === u ? e.between[1] : e.between[0];
      if (v === u || done.has(v) || v === EXTERIOR_NODE) continue;
      const nc = Math.min(cap.get(u)!, e.estimatedClearWidth);
      const nh = hops.get(u)! + 1;
      const oc = cap.get(v);
      if (oc === undefined || nc > oc || (nc === oc && nh < hops.get(v)!)) {
        cap.set(v, nc);
        hops.set(v, nh);
        via.set(v, e);
        prev.set(v, u);
      }
    }
  }
  return (roomId: string): AccessEdge[] | null => {
    const w = widthOf.get(roomId);
    const c = cap.get(roomId);
    if (w === undefined || c === undefined || Math.round(c) !== w) return null;
    const path: AccessEdge[] = [];
    for (let n = roomId; via.has(n); n = prev.get(n)!) {
      const e = via.get(n)!;
      path.push(e);
      const up = prev.get(n)!;
      if (up !== EXTERIOR_NODE) {
        const wu = widthOf.get(up);
        // A room on the way whose reading is under its door capacity has a furniture pinch;
        // it can only be THE pinch if it is no wider than the room's own reading.
        if (wu === undefined || (wu <= w && wu !== Math.round(cap.get(up)!))) return null;
      }
    }
    return path.reverse();
  };
}

/**
 * A route's pinch is PROVABLY a connector of one of its end rooms when that room's widest
 * connector is exactly the route's width: a route leaves its origin's floor and enters its
 * destination's through one of their connectors, so it passes one at least that narrow. The
 * connectors of that width are the candidates. Used only to recognise a pinch already
 * reported, never to name one.
 */
function endConnectorsAt(ctx: LintContext, roomId: string, width: number): AccessEdge[] | null {
  if (ctx.building.arrivalRooms.includes(roomId)) return null;
  const mine = ctx.access().edges.filter((e) => !e.ambiguous && e.between.includes(roomId));
  if (mine.length === 0) return null;
  if (Math.round(Math.max(...mine.map((e) => e.estimatedClearWidth))) !== width) return null;
  return mine.filter((e) => Math.round(e.estimatedClearWidth) === width);
}

/**
 * How many re-measures (room readings on a plan variant, {@link roomBottlenecks}) one `lint()`
 * run may build to verify door attributions — union and exact alike, all storeys together
 * (`BuildingContext.attributionMeasures`); a count, never a time. A room still unverified when it is spent gets the unattributed hints. Small on purpose:
 * the playground lints on every keystroke, and on a tree-shaped door graph the first union
 * settles every room by itself.
 */
export const MAX_ATTRIBUTION_MEASURES = 2;

/** One candidate set's identity: its connector ids, sorted. The ONE key this module uses. */
const setKey = (set: readonly AccessEdge[]): string =>
  set
    .map((e) => e.doorId)
    .sort()
    .join("\u0000");

/**
 * Which connectors can matter to which room: a door can change a room's walk only if it lies on
 * some simple path from a source to that room, i.e. its biconnected block lies on the
 * block-cut-tree path from the sources to the room. A door into a dead-end branch (a bedroom
 * off the corridor, the rest of a chain past this room) cannot. Returns `relevant(e, roomId)`;
 * a room the sources do not reach treats every door as relevant (the conservative answer).
 */
function relevance(ctx: LintContext, edges: readonly AccessEdge[]): (e: AccessEdge, roomId: string) => boolean {
  const ROOT = "\u0000root";
  const index = new Map<string, number>([[ROOT, 0]]);
  const idOf = (n: string): number => {
    let i = index.get(n);
    if (i === undefined) {
      i = index.size;
      index.set(n, i);
    }
    return i;
  };
  const ends: [number, number][] = [];
  const edgeIndex = new Map<AccessEdge, number>();
  for (const e of edges) {
    edgeIndex.set(e, ends.length);
    ends.push([idOf(e.between[0]), idOf(e.between[1])]);
  }
  // The super-root joins every source the circulation model walks from.
  const sources = ctx.access().hasEntrance ? [EXTERIOR_NODE] : ctx.building.arrivalRooms;
  for (const s of sources) ends.push([0, idOf(s)]);
  const n = index.size;
  const adj: [number, number][][] = Array.from({ length: n }, () => []);
  ends.forEach(([a, b], k) => {
    if (a === b) return;
    adj[a]!.push([b, k]);
    adj[b]!.push([a, k]);
  });
  // Biconnected blocks by edge, iteratively (no recursion depth to blow on a long chain).
  const disc = new Array<number>(n).fill(-1);
  const low = new Array<number>(n).fill(0);
  const blockOf = new Array<number>(ends.length).fill(-1);
  const stack: number[] = [];
  let blocks = 0;
  let timer = 0;
  disc[0] = low[0] = timer++;
  const frames: { v: number; pe: number; i: number }[] = [{ v: 0, pe: -1, i: 0 }];
  while (frames.length > 0) {
    const f = frames[frames.length - 1]!;
    if (f.i < adj[f.v]!.length) {
      const [w, k] = adj[f.v]![f.i++]!;
      if (k === f.pe) continue;
      if (disc[w] === -1) {
        stack.push(k);
        disc[w] = low[w] = timer++;
        frames.push({ v: w, pe: k, i: 0 });
      } else if (disc[w]! < disc[f.v]!) {
        stack.push(k);
        low[f.v] = Math.min(low[f.v]!, disc[w]!);
      }
      continue;
    }
    frames.pop();
    const p = frames[frames.length - 1];
    if (!p) break;
    low[p.v] = Math.min(low[p.v]!, low[f.v]!);
    if (low[f.v]! >= disc[p.v]!) {
      for (;;) {
        const k = stack.pop()!;
        blockOf[k] = blocks;
        if (k === f.pe) break;
      }
      blocks++;
    }
  }
  // The block-cut tree as a vertex↔block bipartite tree; parents from the root.
  const blockVerts: Set<number>[] = Array.from({ length: blocks }, () => new Set<number>());
  ends.forEach(([a, b], k) => {
    const blk = blockOf[k]!;
    if (blk < 0) return;
    blockVerts[blk]!.add(a);
    blockVerts[blk]!.add(b);
  });
  const vertBlocks: number[][] = Array.from({ length: n }, () => []);
  blockVerts.forEach((vs, blk) => {
    for (const v of vs) vertBlocks[v]!.push(blk);
  });
  const parentOfVert = new Array<number>(n).fill(-2); // a block id, or -1 at the root
  const parentOfBlock = new Array<number>(blocks).fill(-2); // a vertex id
  parentOfVert[0] = -1;
  const queue: [boolean, number][] = [[true, 0]];
  for (let q = 0; q < queue.length; q++) {
    const [isVert, x] = queue[q]!;
    if (isVert) {
      for (const blk of vertBlocks[x]!)
        if (parentOfBlock[blk] === -2) {
          parentOfBlock[blk] = x;
          queue.push([false, blk]);
        }
    } else {
      for (const v of blockVerts[x]!)
        if (parentOfVert[v] === -2) {
          parentOfVert[v] = x;
          queue.push([true, v]);
        }
    }
  }
  const onPath = new Map<string, Set<number> | null>();
  const pathBlocks = (roomId: string): Set<number> | null => {
    if (onPath.has(roomId)) return onPath.get(roomId)!;
    const v0 = index.get(roomId);
    let out: Set<number> | null = null;
    if (v0 !== undefined && parentOfVert[v0] !== -2) {
      out = new Set<number>();
      for (let v = v0; v !== 0; ) {
        const blk = parentOfVert[v]!;
        out.add(blk);
        v = parentOfBlock[blk]!;
      }
    }
    onPath.set(roomId, out);
    return out;
  };
  return (e, roomId) => {
    const blocksOnPath = pathBlocks(roomId);
    const k = edgeIndex.get(e);
    if (blocksOnPath === null || k === undefined) return true;
    const blk = blockOf[k]!;
    return blk >= 0 && blocksOnPath.has(blk);
  };
}

/**
 * The doors to name for each warned room's pinch, VERIFIED before any is quoted: a set is
 * named only if, with every door in it widened to the width its hint quotes
 * ({@link clearingWidth}), the room's walk clears the minimum on a rebuilt circulation model.
 *
 * Candidates per room, in order: the widest door path's connectors as narrow as the reading
 * ({@link bottleneckDoors}); those plus the room's own doors of that width (two tied ways in);
 * the room's own tied doors alone; and every connector on the path under the minimum, each at
 * its own clearing width (a front door at 840 mm before a 740 mm bedroom door, under the
 * accessibility profile, needs both).
 *
 * The cost is bounded by COUNTS. Widening is monotone (a wider door can only widen a walk), so:
 *   1. the door graph first: a room whose door-only capacity with every candidate widened stays
 *      under the minimum cannot clear, and costs no grid at all (and again per tier below);
 *   2. then tier by tier — every remaining room's first candidate set, then its second, … —
 *      ONE union model per tier with every door of that tier widened ({@link roomBottlenecks},
 *      the readings alone): a room that does not clear there does not clear with its own
 *      subset either, and moves on to its next tier;
 *   3. a room that does clear there is settled by that model alone when every widened door
 *      outside its set is off every simple path to it ({@link relevance}: its block is not on
 *      the room's block-cut-tree path), because those doors cannot reach its walk;
 *   4. otherwise an exact model, shared by every such room whose set is off the others' paths
 *      (each is then its own set's model, by the argument in 3).
 * Every model in 2 and 4 counts against {@link MAX_ATTRIBUTION_MEASURES} per run; past it the
 * remaining rooms get the unattributed hints.
 * Step 3 reads the door graph: a widened doorway's raster could in principle open a cell a walk
 * slips through beside an obstacle, which the graph does not see; the corpus test that applies
 * every named width and re-measures is the check on that.
 */
function attributeBottlenecks(
  ctx: LintContext,
  widthOf: ReadonlyMap<string, number>,
  warnedRooms: readonly string[],
): Map<string, AccessEdge[]> {
  const min = ctx.rules.minPathClearWidthMm;
  const edges = ctx.access().edges.filter((e) => !e.ambiguous && e.between[0] !== "" && e.between[1] !== "");
  const tree = bottleneckDoors(ctx, widthOf, edges);
  const candidates = new Map<string, AccessEdge[][]>();
  for (const roomId of warnedRooms) {
    const w = widthOf.get(roomId);
    if (w === undefined) continue;
    const path = tree(roomId);
    const atW = (path ?? []).filter((e) => Math.round(e.estimatedClearWidth) === w);
    const under = (path ?? []).filter((e) => e.estimatedClearWidth < min);
    const own = edges.filter((e) => e.between.includes(roomId) && Math.round(e.estimatedClearWidth) === w);
    const both = [...atW, ...own.filter((e) => !atW.includes(e))];
    const seen = new Set<string>();
    const sets: AccessEdge[][] = [];
    for (const set of [atW, both, own, under]) {
      const key = setKey(set);
      if (set.length === 0 || seen.has(key)) continue;
      seen.add(key);
      sets.push(set);
    }
    if (sets.length > 0) candidates.set(roomId, sets);
  }
  const named = new Map<string, AccessEdge[]>();
  if (candidates.size === 0) return named;

  const widen = (set: Iterable<AccessEdge>) => new Map([...set].map((e) => [e.doorId, clearingWidth(e, ctx)]));
  // 1. The door graph: drop rooms whose door-only capacity cannot reach the minimum.
  const all = new Set([...candidates.values()].flat(2));
  const capAll = doorCapacity(ctx, edges, widen(all));
  for (const roomId of [...candidates.keys()]) if ((capAll.get(roomId) ?? 0) < min) candidates.delete(roomId);
  if (candidates.size === 0) return named;

  const measure = (wider: ReadonlyMap<string, number>): ReadonlyMap<string, number> => {
    const doors = ctx.doors.map((d) => (wider.has(d.id) ? { ...d, width: wider.get(d.id)! } : d));
    const openings = ctx.openings.map((o) => (wider.has(o.id) ? { ...o, width: wider.get(o.id)! } : o));
    const access = buildDoorAccessGraph(ctx.rooms, doors, ctx.rules.tolMm, undefined, openings);
    return roomBottlenecks(
      ctx.rooms,
      ctx.ir.walls,
      doors,
      openings,
      ctx.furniture,
      access,
      ctx.rules.tolMm,
      ctx.verticals,
      ctx.voids,
      ctx.building.arrivalShafts,
    );
  };
  const clearsIn = (readings: ReadonlyMap<string, number> | undefined, roomId: string): boolean =>
    (readings?.get(roomId) ?? 0) >= min;
  // 2–4. Tier by tier (every remaining room's first candidate, then its second, …): ONE union
  // model per tier, with every door of that tier's sets widened, all within the count budget.
  const relevant = relevance(ctx, edges);
  // Shared by every storey of the run when there are several; this storey's own otherwise.
  const budget = ctx.building.attributionMeasures ?? { left: MAX_ATTRIBUTION_MEASURES };
  const tiers = Math.max(...[...candidates.values()].map((sets) => sets.length));
  for (let k = 0; k < tiers && budget.left > 0; k++) {
    const sets = new Map<string, AccessEdge[]>();
    for (const [roomId, list] of candidates) if (!named.has(roomId) && list[k]) sets.set(roomId, list[k]!);
    // The door graph again, per room for this tier: a set whose best way through it stays
    // under the minimum is dropped here (it would only widen the tier for the other rooms).
    for (const [roomId, set] of [...sets]) if (throughSet(ctx, edges, set, roomId) < min) sets.delete(roomId);
    const tier = new Set([...sets.values()].flat());
    if (sets.size === 0) continue;
    budget.left--;
    const tierModel = measure(widen(tier));
    // 3. The tier model is a room's own set's model whenever the tier's other doors are off
    // every simple path to it.
    const quiet = (doors: Iterable<AccessEdge>, set: readonly AccessEdge[], roomId: string) =>
      [...doors].every((e) => set.includes(e) || !relevant(e, roomId));
    const unproven: string[] = [];
    for (const roomId of warnedRooms) {
      const set = sets.get(roomId);
      if (!set || !clearsIn(tierModel, roomId)) continue;
      if (quiet(tier, set, roomId)) named.set(roomId, set);
      else unproven.push(roomId);
    }
    // 4. Exact models for the rest, GROUPED: rooms whose sets are mutually off each other's
    // paths share one model (each is then its own set's model for that room), in source order.
    while (unproven.length > 0 && budget.left > 0) {
      const group: string[] = [];
      const doors = new Set<AccessEdge>();
      for (const roomId of [...unproven]) {
        const set = sets.get(roomId)!;
        const fits = quiet(doors, set, roomId) && group.every((other) => quiet(set, sets.get(other)!, other));
        if (!fits) continue;
        group.push(roomId);
        for (const e of set) doors.add(e);
        unproven.splice(unproven.indexOf(roomId), 1);
      }
      budget.left--;
      const model = measure(widen(doors));
      for (const roomId of group) if (clearsIn(model, roomId)) named.set(roomId, sets.get(roomId)!);
    }
  }
  return named;
}

/** Door-only widest-path capacity of every room, with `wider` connectors at their new widths. */
function doorCapacity(
  ctx: LintContext,
  edges: readonly AccessEdge[],
  wider: ReadonlyMap<string, number>,
  from?: string,
): Map<string, number> {
  const cap = new Map<string, number>();
  if (from !== undefined) cap.set(from, Number.POSITIVE_INFINITY);
  else if (ctx.access().hasEntrance) cap.set(EXTERIOR_NODE, Number.POSITIVE_INFINITY);
  // An arrival room is a source at an unbounded width here: this is an UPPER bound.
  else for (const id of ctx.building.arrivalRooms) cap.set(id, Number.POSITIVE_INFINITY);
  const done = new Set<string>();
  for (;;) {
    let u: string | null = null;
    for (const [k, c] of cap) if (!done.has(k) && (u === null || c > cap.get(u)!)) u = k;
    if (u === null) break;
    done.add(u);
    for (const e of edges) {
      if (!e.between.includes(u)) continue;
      const v = e.between[0] === u ? e.between[1] : e.between[0];
      if (done.has(v)) continue;
      const nc = Math.min(cap.get(u)!, widenedClear(e, wider));
      if (nc > (cap.get(v) ?? Number.NEGATIVE_INFINITY)) cap.set(v, nc);
    }
  }
  return cap;
}

/** A connector's clear width with `wider` applied (the leaf allowance kept for a door). */
const widenedClear = (e: AccessEdge, wider: ReadonlyMap<string, number>): number =>
  wider.has(e.doorId) ? wider.get(e.doorId)! - (e.nominalWidth - e.estimatedClearWidth) : e.estimatedClearWidth;

/**
 * The widest door-only way to `roomId` that USES a widened door of `set` — an upper bound on
 * what widening `set` can do for the room. Every other way is unchanged by it, and the room's
 * reading already shows none of those clears, so a set whose best way through it stays under
 * the minimum cannot clear the room (the door into a bedroom whose own door is fine but whose
 * bed blocks it). For each door of the set, either way round: the widest way to its near side
 * and from its far side to the room, each found without that door.
 */
function throughSet(
  ctx: LintContext,
  edges: readonly AccessEdge[],
  set: readonly AccessEdge[],
  roomId: string,
): number {
  const wider = new Map(set.map((e) => [e.doorId, clearingWidth(e, ctx)]));
  let best = Number.NEGATIVE_INFINITY;
  for (const e of set) {
    const others = edges.filter((x) => x !== e);
    const toNear = doorCapacity(ctx, others, wider);
    for (const [near, far] of [
      [e.between[0], e.between[1]],
      [e.between[1], e.between[0]],
    ] as const) {
      const reach = toNear.get(near) ?? Number.NEGATIVE_INFINITY;
      const onward =
        far === roomId
          ? Number.POSITIVE_INFINITY
          : (doorCapacity(ctx, others, wider, far).get(roomId) ?? Number.NEGATIVE_INFINITY);
      best = Math.max(best, Math.min(reach, widenedClear(e, wider), onward));
    }
  }
  return best;
}

/** The message clause naming the connectors a walk squeezes through, or nothing. */
function namedClause(doors: readonly AccessEdge[] | null, width: number): string {
  if (doors === null) return "";
  const same = doors.every((e) => Math.round(e.estimatedClearWidth) === width);
  const list = doors.map(
    (e) => `${e.kind} "${e.doorId}"${same ? "" : ` (${mm(Math.round(e.estimatedClearWidth))} mm clear)`}`,
  );
  if (list.length === 1) return ` — the bottleneck is ${list[0]}, ${mm(width)} mm clear`;
  const joined = `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
  return ` — the bottlenecks are ${joined}${same ? `, each ${mm(width)} mm clear` : ""}: widen them together`;
}

export const pathTooNarrow: LintRule = {
  name: "path-too-narrow",
  check(ctx: LintContext): Diagnostic[] {
    const circ = circulationOf(ctx);
    if (!circ) return [];
    const { rooms, labelOf, at } = ctx;
    const min = ctx.rules.minPathClearWidthMm;
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const out: Diagnostic[] = [];
    // One warning per room: entrance-walk pinches first, then a key route's pinch on a
    // from-room not already flagged (dedupe deterministically — rooms, then routes).
    const warned = new Set<string>();
    // One warning per bottleneck OPENING too. A walk or route whose pinch is connectors that
    // an earlier warning already named is the same defect and is withdrawn; it still counts
    // as warned, so the set of warnings is always a subset of the one-per-room set above.
    const reported = new Set<string>();
    const already = (doors: readonly AccessEdge[] | null): boolean =>
      doors?.every((e) => reported.has(e.doorId)) ?? false;
    // Walk the rooms in SOURCE order rather than walking `circ.rooms`, so a blocked room
    // — which by construction has no `circ.rooms` entry — lands where it belongs instead
    // of nowhere. `circ.rooms` is itself in source order, so a plan with nothing blocked
    // emits exactly the diagnostics, in exactly the order, it emitted before.
    const factOf = new Map(circ.rooms.map((rc) => [rc.roomId, rc]));
    const blocked = new Map((circ.blocked ?? []).map((b) => [b.roomId, b.widestWayInMm]));
    const named = attributeBottlenecks(
      ctx,
      new Map(circ.rooms.map((rc) => [rc.roomId, rc.bottleneckClearWidthMm])),
      rooms
        .filter((r) => !blocked.has(r.id) && (factOf.get(r.id)?.bottleneckClearWidthMm ?? min) < min)
        .map((r) => r.id),
    );
    for (const r of rooms) {
      const wayIn = blocked.get(r.id);
      if (wayIn !== undefined) {
        warned.add(r.id);
        // Two different claims, and saying the stronger one when the weaker is true is
        // the whole of 5.8. A room with a real but too-narrow way in gets that width, in
        // the same measured-deficit style as every other rule; only a room with no gap
        // at all is called a seal.
        const message =
          wayIn > 0
            ? `The walk from the entrance to "${labelOf(r)}" squeezes to ${mm(wayIn)} mm and stops there — no way in is wider, so no route reaches the room (${mm(shortfall(min, wayIn))} mm below the ${mm(min)} mm minimum).`
            : `The walk from the entrance to "${labelOf(r)}" is blocked: furniture and its clearances leave no gap at all (0 mm against the ${mm(min)} mm minimum).`;
        out.push({
          severity: "warning",
          code: "W_PATH_TOO_NARROW",
          ...at(r),
          message,
          hints: narrowHints(min, null, ctx),
        });
        continue;
      }
      const rc = factOf.get(r.id);
      if (!rc || rc.bottleneckClearWidthMm >= min) continue;
      warned.add(r.id);
      const doors = named.get(r.id) ?? null;
      if (already(doors)) continue;
      for (const e of doors ?? []) reported.add(e.doorId);
      out.push({
        severity: "warning",
        code: "W_PATH_TOO_NARROW",
        ...at(r),
        message: `The walk from the entrance to "${labelOf(r)}" squeezes to ${mm(rc.bottleneckClearWidthMm)} mm (${mm(shortfall(min, rc.bottleneckClearWidthMm))} mm below the ${mm(min)} mm minimum)${namedClause(doors, rc.bottleneckClearWidthMm)}.`,
        hints: narrowHints(min, doors, ctx),
      });
    }
    for (const rt of circ.routes) {
      if (rt.bottleneckClearWidthMm >= min || warned.has(rt.fromRoomId)) continue;
      const from = roomById.get(rt.fromRoomId);
      if (!from) continue;
      const to = roomById.get(rt.toRoomId);
      warned.add(rt.fromRoomId);
      // A route through an end room's connectors that an earlier warning already named.
      const w = rt.bottleneckClearWidthMm;
      if (already(endConnectorsAt(ctx, rt.toRoomId, w)) || already(endConnectorsAt(ctx, rt.fromRoomId, w))) continue;
      out.push({
        severity: "warning",
        code: "W_PATH_TOO_NARROW",
        ...at(from),
        message: `The route from "${labelOf(from)}" to "${to ? labelOf(to) : rt.toRoomId}" squeezes to ${mm(w)} mm (${mm(shortfall(min, w))} mm below the ${mm(min)} mm minimum).`,
        hints: narrowHints(min, null, ctx),
      });
    }
    return out;
  },
};

export const circuitousPath: LintRule = {
  name: "circuitous-path",
  check(ctx: LintContext): Diagnostic[] {
    const circ = circulationOf(ctx);
    if (!circ) return [];
    const { rooms, labelOf, at } = ctx;
    const max = ctx.rules.maxDetourRatio;
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const out: Diagnostic[] = [];
    for (const rc of circ.rooms) {
      if (rc.detourRatio <= max) continue;
      const r = roomById.get(rc.roomId);
      if (!r) continue;
      // One record is one route (owner decision, backlog C.3): the ratio is the walk from
      // the room's NEAREST entrance by walk, over the straight line from that SAME entrance —
      // not the least ratio over every entrance. So the message names the door it measures
      // from; a single-entrance plan's model carries it in the header.
      const entrance = rc.entranceId ?? circ.entranceId;
      out.push({
        severity: "warning",
        code: "W_CIRCUITOUS_PATH",
        ...at(r),
        message: `The walk from entrance "${entrance}" to "${labelOf(r)}" is ${rc.detourRatio}× the straight-line distance from that entrance (over ${max}×).`,
        hints: ["Add a more direct connection — a door or a hall — so the room isn't reached the long way round."],
      });
    }
    return out;
  },
};
