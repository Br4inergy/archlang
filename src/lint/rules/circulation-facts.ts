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

import { type CirculationModel, computeCirculation } from "../../analyze/circulation.js";
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
 * every named door, was re-measured to clear the minimum ({@link attributeBottleneck});
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
        ...(doors.length > 1
          ? [
              `With ${doors.length === 2 ? "both" : `all ${doors.length}`} widened the walk clears the ${mm(min)} mm minimum.`,
            ]
          : []),
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
 * A CANDIDATE set of doors and openings a room's walk squeezes through at its bottleneck
 * width, or `null`. Never quoted on its own: {@link attributeBottleneck} re-measures it first.
 *
 * Built on the DOOR graph: rooms joined by their connectors, each weighted by its clear width,
 * walked from exactly the sources the circulation model walks from (the exterior through the
 * front doors; ONLY on a storey with no front door, the rooms its shafts arrive in, at their
 * own measured width: `computeCirculation`'s `viaShaft`). A widest-path search gives each
 * room a door-only capacity and one path to it; ties keep the first label settled, so the path
 * is deterministic but not guaranteed to have the fewest doors (ranking by width then door
 * count is not isotone, `src/algebra/semiring.ts`). The candidate is the connectors on that
 * path exactly as narrow as the reading, so doors in series name both, provided:
 *   - the room's reading equals its door capacity (otherwise furniture inside it sets it), and
 *   - every room the path passes through either reads its own door capacity or reads wider
 *     than this room (otherwise furniture in a room on the way could be the pinch).
 */
function bottleneckDoors(
  ctx: LintContext,
  widthOf: ReadonlyMap<string, number>,
): (roomId: string) => AccessEdge[] | null {
  const edges = ctx.access().edges.filter((e) => !e.ambiguous && e.between[0] !== "" && e.between[1] !== "");
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
    const named: AccessEdge[] = [];
    for (let n = roomId; via.has(n); n = prev.get(n)!) {
      const e = via.get(n)!;
      if (Math.round(e.estimatedClearWidth) === w) named.push(e);
      const up = prev.get(n)!;
      if (up !== EXTERIOR_NODE) {
        const wu = widthOf.get(up);
        // A room on the way whose reading is under its door capacity has a furniture pinch;
        // it can only be THE pinch if it is no wider than the room's own reading.
        if (wu === undefined || (wu <= w && wu !== Math.round(cap.get(up)!))) return null;
      }
    }
    return named.length > 0 ? named.reverse() : null;
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
 * The doors to name for a room's pinch, VERIFIED: each candidate set is applied — every door in
 * it widened to the width its hint quotes ({@link clearingWidth}), the access graph and the
 * circulation model rebuilt exactly as this rule builds them — and quoted only if the room's
 * walk then clears the minimum. Candidates, in order: the widest door path's narrow doors
 * ({@link bottleneckDoors}); those plus the room's own doors of the same width (two tied ways
 * in, where the path picked the one a furniture pinch spoils); the room's own tied doors alone.
 * None clears → `null`, and the warning names no door. Each distinct set is measured once per
 * `lint()` run (the measure is the nav grid again, so it is paid only for rooms that warn).
 */
function attributeBottleneck(
  ctx: LintContext,
  widthOf: ReadonlyMap<string, number>,
): (roomId: string) => AccessEdge[] | null {
  const tree = bottleneckDoors(ctx, widthOf);
  const min = ctx.rules.minPathClearWidthMm;
  const measured = new Map<string, CirculationModel | null>();
  const clears = (set: readonly AccessEdge[], roomId: string): boolean => {
    const key = set
      .map((e) => e.doorId)
      .sort()
      .join("\u0000");
    if (!measured.has(key)) {
      const wider = new Map(set.map((e) => [e.doorId, clearingWidth(e, ctx)]));
      const doors = ctx.doors.map((d) => (wider.has(d.id) ? { ...d, width: wider.get(d.id)! } : d));
      const openings = ctx.openings.map((o) => (wider.has(o.id) ? { ...o, width: wider.get(o.id)! } : o));
      const access = buildDoorAccessGraph(ctx.rooms, doors, ctx.rules.tolMm, undefined, openings);
      measured.set(
        key,
        computeCirculation(
          ctx.rooms,
          ctx.ir.walls,
          doors,
          openings,
          ctx.furniture,
          access,
          ctx.rules.tolMm,
          undefined,
          ctx.verticals,
          ctx.voids,
          ctx.building.arrivalShafts,
        ),
      );
    }
    const after = measured.get(key)?.rooms.find((rc) => rc.roomId === roomId);
    return after !== undefined && after.bottleneckClearWidthMm >= min;
  };
  return (roomId: string): AccessEdge[] | null => {
    const w = widthOf.get(roomId);
    if (w === undefined) return null;
    const path = tree(roomId) ?? [];
    const own = ctx
      .access()
      .edges.filter((e) => !e.ambiguous && e.between.includes(roomId) && Math.round(e.estimatedClearWidth) === w);
    const both = [...path, ...own.filter((e) => !path.includes(e))];
    const seen = new Set<string>();
    for (const set of [path, both, own]) {
      const key = set.map((e) => e.doorId).join(",");
      if (set.length === 0 || seen.has(key)) continue;
      seen.add(key);
      if (clears(set, roomId)) return set;
    }
    return null;
  };
}

/** The message clause naming the connectors a walk squeezes through, or nothing. */
function namedClause(doors: readonly AccessEdge[] | null, width: number): string {
  if (doors === null) return "";
  const list = doors.map((e) => `${e.kind} "${e.doorId}"`);
  return list.length === 1
    ? ` — the bottleneck is ${list[0]}, ${mm(width)} mm clear`
    : ` — the bottlenecks are ${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}, each ${mm(width)} mm clear: widen all of them`;
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
    const doorsOf = attributeBottleneck(ctx, new Map(circ.rooms.map((rc) => [rc.roomId, rc.bottleneckClearWidthMm])));
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
      const doors = doorsOf(r.id);
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
