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
import type { AccessEdge } from "../../analyze.js";
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
 * chose. When the room's own doors set the limit ({@link doorBottleneck}) the first hint
 * names each one and the `width` that clears the minimum; otherwise the bottleneck is a
 * nav-grid CELL the model cannot attribute to one element. `arch repair` is deliberately
 * not named; it clears wall intrusions, swings, doorway landings and overlaps, not a route
 * pinch, and pointing at a tool that would report "nothing to do" is worse than silence.
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
            `Widen ${e.kind} "${e.doorId}" to \`width ${mm(clearingWidth(e, ctx))}\` (now ${mm(e.nominalWidth)}), which leaves the ${mm(min)} mm minimum clear${e.kind === "door" ? " after the leaf allowance" : ""}.`,
        ),
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
 * The room's own connectors that ARE its bottleneck, or `null` when its doors do not explain it.
 *
 * Every walk or route into a room crosses one of its connectors (`computeCirculation` stamps
 * each carved doorway with the connector's clear width, so the door caps every path through
 * it), so when the widest connector the room has is exactly `width` wide, no way in can be
 * wider: the doors ARE the limit, and the ones that wide are named. That is exact for a room
 * walled all round; one open to a neighbour can also be entered across the open edge, where
 * a furniture pinch of exactly the door's width would leave the door named but not the only
 * limit — accepted rather than re-running the walk per door. A room you arrive in by a
 * shaft is excluded — the run is a way in that is not a connector — and so is a reading the
 * doors do not reach (a furniture pinch narrower than every door), which stays unattributed.
 */
function doorBottleneck(ctx: LintContext, roomId: string, width: number): AccessEdge[] | null {
  if (ctx.building.arrivalRooms.includes(roomId)) return null;
  const mine = ctx.access().edges.filter((e) => !e.ambiguous && e.between.includes(roomId));
  if (mine.length === 0) return null;
  const widest = Math.round(Math.max(...mine.map((e) => e.estimatedClearWidth)));
  if (widest !== width) return null;
  return mine.filter((e) => Math.round(e.estimatedClearWidth) === width);
}

/** The message clause naming a door-set bottleneck, or nothing. */
function namedClause(doors: readonly AccessEdge[] | null, owner: string | null, width: number): string {
  if (doors === null) return "";
  const whose = owner === null ? "its" : `"${owner}"'s`;
  const list = doors.map((e) => `${e.kind} "${e.doorId}"`);
  return list.length === 1
    ? ` — the bottleneck is ${whose} ${list[0]}, ${mm(width)} mm clear`
    : ` — the bottleneck is ${whose} ways in: ${list.join(" and ")} are each ${mm(width)} mm clear and none is wider`;
}

/** One bottleneck's identity: the connectors that set it, in a fixed order. */
const keyOf = (doors: readonly AccessEdge[] | null): string | null =>
  doors === null
    ? null
    : doors
        .map((e) => e.doorId)
        .sort()
        .join("\u0000");

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
    // One warning per BOTTLENECK too: a pinch the room's own doors explain is reported once,
    // on the first diagnostic that names them; a route squeezing through those same doors
    // (bedroom → its en-suite, through the en-suite's door) is the same defect, not a second.
    const named = new Set<string>();
    // Walk the rooms in SOURCE order rather than walking `circ.rooms`, so a blocked room
    // — which by construction has no `circ.rooms` entry — lands where it belongs instead
    // of nowhere. `circ.rooms` is itself in source order, so a plan with nothing blocked
    // emits exactly the diagnostics, in exactly the order, it emitted before.
    const factOf = new Map(circ.rooms.map((rc) => [rc.roomId, rc]));
    const blocked = new Map((circ.blocked ?? []).map((b) => [b.roomId, b.widestWayInMm]));
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
      const doors = doorBottleneck(ctx, r.id, rc.bottleneckClearWidthMm);
      const key = keyOf(doors);
      if (key !== null) {
        if (named.has(key)) continue;
        named.add(key);
      }
      out.push({
        severity: "warning",
        code: "W_PATH_TOO_NARROW",
        ...at(r),
        message: `The walk from the entrance to "${labelOf(r)}" squeezes to ${mm(rc.bottleneckClearWidthMm)} mm (${mm(shortfall(min, rc.bottleneckClearWidthMm))} mm below the ${mm(min)} mm minimum)${namedClause(doors, null, rc.bottleneckClearWidthMm)}.`,
        hints: narrowHints(min, doors, ctx),
      });
    }
    for (const rt of circ.routes) {
      if (rt.bottleneckClearWidthMm >= min || warned.has(rt.fromRoomId)) continue;
      const from = roomById.get(rt.fromRoomId);
      if (!from) continue;
      const to = roomById.get(rt.toRoomId);
      // The destination's doors first (the route ENTERS through them), then the origin's.
      const intoTo = doorBottleneck(ctx, rt.toRoomId, rt.bottleneckClearWidthMm);
      const doors = intoTo ?? doorBottleneck(ctx, rt.fromRoomId, rt.bottleneckClearWidthMm);
      const owner = intoTo !== null ? (to ? labelOf(to) : rt.toRoomId) : labelOf(from);
      const key = keyOf(doors);
      if (key !== null) {
        if (named.has(key)) continue;
        named.add(key);
      }
      warned.add(rt.fromRoomId);
      out.push({
        severity: "warning",
        code: "W_PATH_TOO_NARROW",
        ...at(from),
        message: `The route from "${labelOf(from)}" to "${to ? labelOf(to) : rt.toRoomId}" squeezes to ${mm(rt.bottleneckClearWidthMm)} mm (${mm(shortfall(min, rt.bottleneckClearWidthMm))} mm below the ${mm(min)} mm minimum)${namedClause(doors, owner, rt.bottleneckClearWidthMm)}.`,
        hints: narrowHints(min, doors, ctx),
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
