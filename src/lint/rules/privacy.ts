/**
 * Circulation and privacy: three advisory rules that read the access graph
 * (`describe().access`, the same `"probe"` graph `reachability.ts` walks).
 *
 *  - `W_ROOM_VIA_PRIVATE`: a room reached only through a bedroom, bathroom or WC.
 *  - `W_WET_ROOM_DOOR`: a bathroom or WC with no door, a door onto a kitchen or dining room,
 *    or two doors that make it a passage.
 *  - `W_ENTRANCE_INTO_PRIVATE`: the way in from outside lands in a bedroom, bathroom or WC.
 *
 * A room's use is {@link roomUses}: its authored `uses` first, then the label vocabulary.
 * A room with no classified use is skipped silently by all three rules for now; card PS2.13
 * of the plan-soundness programme reports that coverage.
 *
 * "Private" is a bedroom, bath or WC use with no public use beside it. A room that is
 * also a living space, dining room, kitchen, hall, circulation or entry (a bedsit authored
 * `uses bedroom living`) is a room people pass through by design, so none of these rules
 * treats it as private.
 *
 * Every message gives the measured fact first, then one line of reason with its source.
 * The hints hold the options, each checked against the room edges the rooms really share
 * ({@link roomsAdjacent}, the predicate behind `describe().rooms[].adjacent`), then an
 * "accept if" line. Element ids appear only in the hints. No rule offers a machine fix: a
 * door is a geometric decision. No option suggests shrinking, deleting or relabelling a room,
 * and every door an option proposes is held to a width floor, so a plan cannot satisfy a
 * rule by cutting a room down to a sliver.
 */

import type { UseKind } from "../../ast.js";
import {
  accessDigraph,
  type AccessEdge,
  doorFacesBalcony,
  EXTERIOR_NODE,
  isBedroom,
  reachFrom,
  type RoomBox,
  roomRing,
  roomsAdjacent,
  roomUses,
  wetRoomsOnlyViaBedroom,
} from "../../analyze.js";
import type { Digraph } from "../../algebra/paths.js";
import type { Diagnostic } from "../../diagnostics.js";
import type { WallSegment } from "../../geometry.js";
import { collinearOverlapLength, polygonEdges } from "../../geometry/polygon.js";
import type { RDoor, ROutdoor, RRoom } from "../../ir.js";
import { fmt2 } from "../../num-format.js";
import type { LintContext, LintRule } from "../context.js";

/** Uses that make a room one people pass through by design. */
const PUBLIC_USES: ReadonlySet<UseKind> = new Set<UseKind>([
  "living",
  "dining",
  "kitchen",
  "hall",
  "circulation",
  "entry",
]);
/** Uses of a room a person lives in rather than visits (the wet-room door rules' "habitable"). */
const HABITABLE_USES: ReadonlySet<UseKind> = new Set<UseKind>(["living", "dining", "kitchen", "bedroom", "office"]);
/** Uses of a room that may sit inside a private suite: a bath's far side is one of these. */
const SUITE_USES: ReadonlySet<UseKind> = new Set<UseKind>(["bedroom", "bath", "wc", "storage"]);
/** Uses of a room a door may be moved onto to take it off a kitchen: circulation. */
const CIRCULATION_USES: ReadonlySet<UseKind> = new Set<UseKind>(["hall", "circulation", "entry"]);

type PrivateKind = "bedroom" | "bath" | "wc";
const NOUN: Record<PrivateKind, string> = { bedroom: "bedroom", bath: "bathroom", wc: "WC" };

/**
 * The narrowest door an option may propose into a room of each use: GB 50096-2011 Table
 * 5.8.7's door openings (bedroom and living 900 mm, kitchen 800, bath and WC 700), read as
 * advice. A room with several uses takes the widest; an unlisted use takes 800.
 */
function doorFloorMm(uses: ReadonlySet<UseKind>): number {
  let w = 0;
  for (const u of uses) {
    const f = u === "bath" || u === "wc" ? 700 : u === "kitchen" ? 800 : HABITABLE_USES.has(u) ? 900 : 800;
    w = Math.max(w, f);
  }
  return w || 800;
}
/** The wall a door needs beyond its own width: a 100 mm nib at each jamb. */
const NIBS_MM = 200;
/** A front door's width floor (GB 50096-2011 Table 5.8.7, 户门 1000 mm, as advice). */
const FRONT_DOOR_MM = 1000;
/** The clear width a corridor an option proposes must keep (GB 50096-2011 5.7.1: 900 mm). */
const CORRIDOR_MM = 900;
/** The clear width of an entrance lobby an option proposes (GB 50096-2011 5.7.1: 1200 mm). */
const ENTRY_LOBBY_MM = 1200;

const mm = (n: number): string => fmt2(Math.round(n));

/** The room's private kind, or `null` when it has no such use or a public use beside it. */
function privateKind(uses: ReadonlySet<UseKind>): PrivateKind | null {
  for (const u of uses) if (PUBLIC_USES.has(u)) return null;
  if (uses.has("bedroom")) return "bedroom";
  if (uses.has("bath")) return "bath";
  if (uses.has("wc")) return "wc";
  return null;
}

const hasAny = (uses: ReadonlySet<UseKind>, of: ReadonlySet<UseKind>): boolean => {
  for (const u of uses) if (of.has(u)) return true;
  return false;
};

/** Does the edge join two spaces (not ambiguous, both ends named)? */
const joins = (e: AccessEdge): boolean => !e.ambiguous && e.between[0] !== "" && e.between[1] !== "";

/** Length (mm) of boundary two room floors share, measured on their rings (centrelines). */
function sharedEdgeMm(a: RoomBox, b: RoomBox, tol: number): number {
  if (!roomsAdjacent(a, b, tol)) return 0;
  let total = 0;
  const eb = polygonEdges(roomRing(b));
  for (const [a1, a2] of polygonEdges(roomRing(a))) {
    for (const [b1, b2] of eb) total += collinearOverlapLength(a1, a2, b1, b2, tol);
  }
  return total;
}

/** Length (mm) of the room's ring that runs along a straight exterior wall's centreline. */
function exteriorRunMm(box: RoomBox, segs: readonly WallSegment[], tol: number): number {
  let total = 0;
  const ext = segs.filter((s) => s.category === "exterior" && !s.arc);
  if (ext.length === 0) return 0;
  for (const [a, b] of polygonEdges(roomRing(box))) {
    for (const s of ext) total += collinearOverlapLength(a, b, s.a, s.b, tol);
  }
  return total;
}

/**
 * Door hops from the way in, never entering a node `avoid` names: the exterior is 0, and a
 * room a shaft lands in is 1 (`extra`), so on a grounded storey this is exactly
 * `describe().access.rooms[].depthFromEntrance`. The keys are the reachable set
 * {@link reachFrom} answers for the same sources.
 */
function hops(
  g: Digraph<string, AccessEdge>,
  extra: readonly string[],
  avoid?: (id: string) => boolean,
  from: readonly string[] = [EXTERIOR_NODE],
): Map<string, number> {
  const dist = new Map<string, number>();
  const queue: string[] = [];
  for (const s of from) {
    if (avoid?.(s) || dist.has(s)) continue;
    dist.set(s, 0);
    queue.push(s);
  }
  for (const s of extra) {
    if (avoid?.(s) || dist.has(s)) continue;
    dist.set(s, 1);
    queue.push(s);
  }
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i]!;
    const d = dist.get(n)!;
    for (const { to } of g.out(n)) {
      if (dist.has(to) || avoid?.(to)) continue;
      dist.set(to, d + 1);
      queue.push(to);
    }
  }
  return dist;
}

/** What the three rules read about one storey, computed once per rule run. */
interface Facts {
  g: Digraph<string, AccessEdge>;
  arrivals: string[];
  /** Is there a way in (an exterior connector, or a shaft from a reachable storey)? */
  wayIn: boolean;
  uses: Map<string, Set<UseKind>>;
  priv: Map<string, PrivateKind>;
  byId: Map<string, RRoom>;
  depth: Map<string, number>;
  /** Hops from the way in avoiding EVERY private room. */
  depthNoPrivate: Map<string, number>;
}

function factsOf(ctx: LintContext): Facts {
  const { rooms, roomRects, building, access } = ctx;
  const g = accessDigraph(
    rooms.map((r) => r.id),
    access().edges,
  );
  const arrivals = building.arrivalRooms.filter((id) => roomRects.has(id));
  const uses = new Map<string, Set<UseKind>>(rooms.map((r) => [r.id, roomUses(r)]));
  const priv = new Map<string, PrivateKind>();
  for (const r of rooms) {
    const k = privateKind(uses.get(r.id)!);
    if (k) priv.set(r.id, k);
  }
  return {
    g,
    arrivals,
    wayIn: g.out(EXTERIOR_NODE).length > 0 || arrivals.length > 0,
    uses,
    priv,
    byId: new Map(rooms.map((r) => [r.id, r])),
    depth: hops(g, arrivals),
    depthNoPrivate: hops(g, arrivals, (id) => priv.has(id)),
  };
}

/**
 * For every room that removing one private room P cuts off from the way in, the private
 * rooms that do so, in order of their depth. P is a bedroom, bath or WC that is reached and
 * has two or more neighbours (a room with one neighbour cuts nothing off).
 */
function privateDominators(ctx: LintContext, f: Facts): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (!f.wayIn) return out;
  const order = new Map(ctx.rooms.map((r, i) => [r.id, i]));
  const ps = ctx.rooms
    .filter((r) => f.priv.has(r.id) && f.depth.has(r.id))
    .filter((r) => new Set(f.g.out(r.id).map((x) => x.to)).size >= 2)
    .sort((a, b) => f.depth.get(a.id)! - f.depth.get(b.id)! || order.get(a.id)! - order.get(b.id)!);
  for (const p of ps) {
    const without = hops(f.g, f.arrivals, (id) => id === p.id);
    for (const r of ctx.rooms) {
      if (r.id === p.id || !f.depth.has(r.id) || without.has(r.id)) continue;
      const list = out.get(r.id) ?? [];
      list.push(p.id);
      out.set(r.id, list);
    }
  }
  return out;
}

const quoted = (ctx: LintContext, r: RRoom): string => `"${ctx.labelOf(r)}"`;

/** `"A"`, `"A" then "B"`, `"A", then "B", then "C"`. */
function chain(names: readonly string[]): string {
  const shown = shorten(names, (n) => `${n} more private rooms`);
  return shown.length <= 2 ? shown.join(" then ") : shown.join(", then ");
}

/** At most four items: past four, the first two, a count of the rest but one, and the last. */
function shorten(items: readonly string[], rest: (n: number) => string): string[] {
  if (items.length <= 4) return [...items];
  return [items[0]!, items[1]!, rest(items.length - 3), items[items.length - 1]!];
}

/**
 * `W_ROOM_VIA_PRIVATE` (plan-soundness PS2.5): remove one bedroom, bathroom or WC P from the
 * access graph, and a room that can no longer be reached from the way in is reached only
 * through P. One warning per such room, naming every private room on its only route and its
 * access depth.
 *
 * Not reported, because the room legitimately belongs behind P: a bath or WC (an en-suite, or
 * a WC compartment behind a bathroom) and a storage room (a wardrobe or dressing room).
 * Balconies and other `outdoor` surfaces are not rooms: a door onto one is an exterior edge, so
 * they are never cut off. A wet room `W_BATH_VIA_BEDROOM` already reports (the storey's only
 * bathroom, behind a bedroom) is not reported again. Rooms with no classified use are skipped
 * silently for now (PS2.13 reports coverage).
 */
export const roomViaPrivate: LintRule = {
  name: "room-via-private",
  check(ctx: LintContext): Diagnostic[] {
    const out: Diagnostic[] = [];
    const f = factsOf(ctx);
    if (!f.wayIn) return out;
    const doms = privateDominators(ctx, f);
    if (doms.size === 0) return out;
    // W_BATH_VIA_BEDROOM's own question, asked exactly as `reachability.ts` asks it.
    const reachAll = reachFrom(f.g, { extraSources: f.arrivals });
    const reachNoBed = reachFrom(f.g, {
      extraSources: f.arrivals,
      avoid: (id) => {
        const r = f.byId.get(id);
        return r ? isBedroom(r) : false;
      },
    });
    const viaBedroom = wetRoomsOnlyViaBedroom(ctx.rooms, reachAll, reachNoBed);
    const order = new Map(ctx.rooms.map((r, i) => [r.id, i]));
    for (const d of ctx.rooms) {
      const ps = doms.get(d.id);
      if (!ps) continue;
      const uses = f.uses.get(d.id)!;
      if (uses.size === 0) continue; // unclassified: skipped (PS2.13)
      const kind = f.priv.get(d.id);
      if (kind === "bath" || kind === "wc") continue; // an en-suite or a WC compartment
      if ([...uses].every((u) => u === "storage")) continue; // a wardrobe or dressing room
      if (viaBedroom.has(d.id)) continue;
      const depth = f.depth.get(d.id)!;
      const names = ps.map((p) => quoted(ctx, f.byId.get(p)!));
      const kinds = [...new Set(ps.map((p) => NOUN[f.priv.get(p)!]))];
      const message =
        `${quoted(ctx, d)} is reached only through ${chain(names)} (access depth ${depth}). ` +
        `A route through a ${kinds.join(" or ")} takes away that room's privacy (Ching's pass-through rule, ` +
        "Alexander pattern 131; ResPlan: about 0.03 % of 16,317 dwellings reach a room this way).";
      out.push({
        severity: "warning",
        code: "W_ROOM_VIA_PRIVATE",
        ...ctx.at(d),
        message,
        hints: viaPrivateHints(ctx, f, d, ps, order),
      });
    }
    return out;
  },
};

function viaPrivateHints(
  ctx: LintContext,
  f: Facts,
  d: RRoom,
  ps: readonly string[],
  order: ReadonlyMap<string, number>,
): string[] {
  const hints: string[] = [];
  const tol = ctx.rules.tolMm;
  const dBox = ctx.roomRects.get(d.id)!;
  const floor = doorFloorMm(f.uses.get(d.id)!);
  // A room reached without passing any private room, with a public use, sharing an edge
  // long enough for a door of the floor width and its nibs.
  const cands: Array<{ r: RRoom; shared: number; depth: number }> = [];
  for (const h of ctx.rooms) {
    if (h.id === d.id || !f.depthNoPrivate.has(h.id) || !hasAny(f.uses.get(h.id)!, PUBLIC_USES)) continue;
    const shared = sharedEdgeMm(ctx.roomRects.get(h.id)!, dBox, tol);
    if (shared < floor + NIBS_MM) continue;
    cands.push({ r: h, shared, depth: f.depthNoPrivate.get(h.id)! + 1 });
  }
  cands.sort((a, b) => a.depth - b.depth || b.shared - a.shared || order.get(a.r.id)! - order.get(b.r.id)!);
  for (const c of cands.slice(0, 3)) {
    hints.push(
      `${quoted(ctx, c.r)} (${c.r.id}) shares ${mm(c.shared)} mm of edge with ${quoted(ctx, d)} (${d.id}), on centrelines: ` +
        `a door at least ${floor} mm wide there reaches it at depth ${c.depth} without passing a bedroom, bathroom or WC.`,
    );
  }
  let outside = false;
  if (!f.priv.has(d.id)) {
    const run = exteriorRunMm(dBox, ctx.wallSegs, tol);
    outside = run >= FRONT_DOOR_MM + NIBS_MM;
    if (outside)
      hints.push(
        `${quoted(ctx, d)} (${d.id}) has ${mm(run)} mm of exterior wall, on centrelines: a door from outside at least ` +
          `${FRONT_DOOR_MM} mm wide there reaches it at depth 1.`,
      );
  }
  if (cands.length === 0 && !outside)
    hints.push(
      `No room reached without a bedroom, bathroom or WC shares a door-wide edge with ${quoted(ctx, d)} (${d.id}), ` +
        `${f.priv.has(d.id) ? "so no new door between rooms" : "and it has no exterior wall for a door, so no single new door"} can fix this: move partitions so a hall or corridor at least ${CORRIDOR_MM} mm clear runs ` +
        "to it, keeping every room at least the size its use needs (do not shrink or delete a room to silence this).",
    );
  hints.push(
    `Accept if the route through ${shorten(ps, (n) => `${n} more`).join(" and ")} is deliberate: a room that ` +
      "belongs to that room's own suite (a dressing room, nursery or study off a main bedroom), or a railroad flat. " +
      "The warning is advisory.",
  );
  return hints;
}

/**
 * `W_WET_ROOM_DOOR` (plan-soundness PS2.6): a bathroom or WC whose door is in the wrong place
 * or missing. One code, three sub-cases, each with its own message:
 *
 *  1. its only connector is a leaf-less `opening` onto a habitable room (living, dining,
 *     kitchen, bedroom, office), so it cannot be closed;
 *  2. a connector joins it straight to a kitchen or dining room with no lobby between
 *     (GB 50096-2011 5.4.3, cited as advice, not compliance). A room that is also the living
 *     room (an open-plan kitchen/living, a studio) is not a kitchen for this sub-case: a bath
 *     opening off the living space is a matter of taste the plan scores, never warns;
 *  3. two or more connectors join it to two different rooms outside a private suite (not a
 *     bedroom, bath, WC or storage room), so it is a passage between them. When one of those
 *     rooms is reached ONLY through the wet room, `W_ROOM_VIA_PRIVATE` already reports it and
 *     this sub-case stays silent.
 *
 * Rooms with no classified use are skipped silently for now (PS2.13 reports coverage).
 */
export const wetRoomDoor: LintRule = {
  name: "wet-room-door",
  check(ctx: LintContext): Diagnostic[] {
    const out: Diagnostic[] = [];
    const f = factsOf(ctx);
    const wets = ctx.rooms.filter((r) => {
      const k = f.priv.get(r.id);
      return k === "bath" || k === "wc";
    });
    if (wets.length === 0) return out;
    const edges = ctx.access().edges.filter(joins);
    const doms = privateDominators(ctx, f);
    const tol = ctx.rules.tolMm;
    const order = new Map(ctx.rooms.map((r, i) => [r.id, i]));
    for (const w of wets) {
      const noun = NOUN[f.priv.get(w.id)!];
      const mine = edges.filter((e) => e.between[0] === w.id || e.between[1] === w.id);
      const far = (e: AccessEdge): string => (e.between[0] === w.id ? e.between[1] : e.between[0]);
      const room = (id: string): RRoom | undefined => f.byId.get(id);
      const wBox = ctx.roomRects.get(w.id)!;
      const reported = new Set<string>();

      // 1. The only connector is a leaf-less opening onto a habitable room.
      const only = mine.length === 1 ? mine[0]! : undefined;
      const onlyTo = only ? room(far(only)) : undefined;
      if (only && only.kind === "opening" && onlyTo && hasAny(f.uses.get(onlyTo.id)!, HABITABLE_USES)) {
        reported.add(only.doorId);
        const hints = [
          `Hang a leaf in it: write \`door\` in place of \`opening\` for ${only.doorId}, at the same position, at least 700 mm wide.`,
          ...movesOnto(ctx, f, w, wBox, CIRCULATION_USES, new Set([onlyTo.id]), order, tol, only.doorId),
          f.priv.get(onlyTo.id) === "bedroom"
            ? `Accept if an open en-suite inside the bedroom suite of ${onlyTo.id} is the design intent. The warning is advisory.`
            : "Accept if an open wash area is the design intent and it is screened from view. The warning is advisory.",
        ];
        out.push({
          severity: "warning",
          code: "W_WET_ROOM_DOOR",
          ...ctx.at(w),
          message:
            `${quoted(ctx, w)} has no door: its only way in is a leaf-less opening ${mm(only.nominalWidth)} mm wide from ` +
            `${quoted(ctx, onlyTo)}. A ${noun} that cannot be closed gives no privacy and lets steam and odour into a ` +
            "habitable room (GB 50096-2011 Table 5.8.7 gives a bath or WC a door of at least 700 mm, cited as advice).",
          hints,
        });
      }

      // 2. A connector straight onto a kitchen or dining room (not the living room too).
      for (const e of mine) {
        if (reported.has(e.doorId)) continue;
        const to = room(far(e));
        if (!to) continue;
        const u = f.uses.get(to.id)!;
        if (u.has("living") || !(u.has("kitchen") || u.has("dining"))) continue;
        if (f.priv.has(to.id)) continue;
        reported.add(e.doorId);
        const what = u.has("kitchen") ? "a kitchen" : "a dining room";
        const moves = movesOnto(ctx, f, w, wBox, CIRCULATION_USES, new Set([to.id]), order, tol, e.doorId);
        out.push({
          severity: "warning",
          code: "W_WET_ROOM_DOOR",
          ...ctx.at(w),
          message:
            `${quoted(ctx, w)} opens straight into ${quoted(ctx, to)}, ${what}, through ${e.kind === "door" ? "a door" : "an opening"} ` +
            `${mm(e.nominalWidth)} mm wide. A ${noun} door should not open directly onto a kitchen or dining room without a lobby ` +
            "(GB 50096-2011 5.4.3, cited as advice, not compliance; ResPlan: about 0.3 % of bath doors open off a kitchen).",
          hints: [
            ...moves,
            ...(moves.length === 0
              ? [
                  `No hall or corridor shares a door-wide edge with ${quoted(ctx, w)} (${w.id}): a lobby at least ` +
                    `${CORRIDOR_MM} mm clear between ${quoted(ctx, to)} (${to.id}) and it keeps the door off the ${what.slice(2)}.`,
                ]
              : []),
            "Accept if the plan follows a code that allows it, or the kitchen is the only room the bathroom can open from. The warning is advisory.",
          ],
        });
      }

      // 3. A passage: two or more connectors joining two different rooms outside a private suite.
      if (mine.length < 2) continue;
      const farRooms: RRoom[] = [];
      const doorTo = new Map<string, string>();
      for (const e of mine) {
        const to = room(far(e));
        if (!to || doorTo.has(to.id)) continue;
        const u = f.uses.get(to.id)!;
        if (u.size === 0 || hasAny(u, SUITE_USES)) continue;
        doorTo.set(to.id, e.doorId);
        farRooms.push(to);
      }
      if (farRooms.length < 2) continue;
      if (farRooms.some((r) => doms.get(r.id)?.includes(w.id))) continue; // W_ROOM_VIA_PRIVATE's
      const names = farRooms.map((r) => quoted(ctx, r));
      // The far room nearest the way in stays; each other one is offered a door from a room
      // it is reached from without the wet room, sharing a door-wide edge with it.
      const without = hops(f.g, f.arrivals, (id) => id === w.id);
      const hop = (id: string): number => without.get(id) ?? Number.MAX_SAFE_INTEGER;
      const near = [...farRooms].sort((a, b) => hop(a.id) - hop(b.id) || order.get(a.id)! - order.get(b.id)!);
      const hints: string[] = [];
      for (const b of near.slice(1)) {
        if (hints.length >= 2) break;
        const floor = doorFloorMm(f.uses.get(b.id)!);
        const bBox = ctx.roomRects.get(b.id)!;
        const cands: Array<{ r: RRoom; shared: number }> = [];
        for (const h of ctx.rooms) {
          if (h.id === w.id || h.id === b.id || !without.has(h.id) || f.priv.has(h.id)) continue;
          const u = f.uses.get(h.id)!;
          if (u.size === 0 || hasAny(u, SUITE_USES)) continue;
          const shared = sharedEdgeMm(ctx.roomRects.get(h.id)!, bBox, tol);
          if (shared >= floor + NIBS_MM) cands.push({ r: h, shared });
        }
        const isFar = (r: RRoom): number => (farRooms.includes(r) ? 0 : 1);
        cands.sort(
          (x, y) =>
            isFar(x.r) - isFar(y.r) ||
            hop(x.r.id) - hop(y.r.id) ||
            y.shared - x.shared ||
            order.get(x.r.id)! - order.get(y.r.id)!,
        );
        const c = cands[0];
        if (!c) continue;
        hints.push(
          `${quoted(ctx, c.r)} (${c.r.id}) shares ${mm(c.shared)} mm of edge with ${quoted(ctx, b)} (${b.id}), on ` +
            `centrelines: re-host ${doorTo.get(b.id)} onto it, at least ${floor} mm wide, so ${quoted(ctx, b)} is ` +
            `reached without crossing the ${noun}.`,
        );
      }
      if (hints.length === 0)
        hints.push(
          `No room reached without the ${noun} shares a door-wide edge with ${near
            .slice(1)
            .map((r) => quoted(ctx, r))
            .join(" or ")}: a hall or ` +
            `corridor at least ${CORRIDOR_MM} mm clear between ${names.join(" and ")} takes the route out of the ${noun}.`,
        );
      hints.push(
        `Accept if ${w.id} is a utility or mud room meant to be walked through, with the ${noun} closed off by a door of its own. The warning is advisory.`,
      );
      out.push({
        severity: "warning",
        code: "W_WET_ROOM_DOOR",
        ...ctx.at(w),
        message:
          `${quoted(ctx, w)} is a passage: its ${mine.length} connectors join ${names.join(" and ")}, so the way between ` +
          `them runs through a ${noun}. A ${noun} should be a dead end off circulation, not a route between rooms ` +
          "(Ching's pass-through rule; privacy and hygiene).",
        hints,
      });
    }
    return out;
  },
};

/** Options moving a wet room's connector onto a room of `uses` it shares a door-wide edge with. */
function movesOnto(
  ctx: LintContext,
  f: Facts,
  w: RRoom,
  wBox: RoomBox,
  uses: ReadonlySet<UseKind>,
  except: ReadonlySet<string>,
  order: ReadonlyMap<string, number>,
  tol: number,
  connectorId: string,
): string[] {
  const cands: Array<{ r: RRoom; shared: number }> = [];
  for (const h of ctx.rooms) {
    if (h.id === w.id || except.has(h.id) || !hasAny(f.uses.get(h.id)!, uses)) continue;
    const shared = sharedEdgeMm(ctx.roomRects.get(h.id)!, wBox, tol);
    if (shared >= 700 + NIBS_MM) cands.push({ r: h, shared });
  }
  cands.sort((a, b) => b.shared - a.shared || order.get(a.r.id)! - order.get(b.r.id)!);
  return cands
    .slice(0, 2)
    .map(
      (c) =>
        `${quoted(ctx, c.r)} (${c.r.id}) shares ${mm(c.shared)} mm of edge with ${quoted(ctx, w)} (${w.id}), on ` +
        `centrelines: re-host ${connectorId} onto it as a door at least 700 mm wide.`,
    );
}

/**
 * `W_ENTRANCE_INTO_PRIVATE` (plan-soundness PS2.7): every door from outside on the storey
 * opens into a bedroom, bathroom or WC (ResPlan: 0 of 16,317 front doors do). One warning per
 * such door.
 *
 * Only a storey's real ways in count: a door onto an `outdoor balcony` is not one, and a storey
 * reached by a shaft (it has no front door of its own) is not checked. When any door from
 * outside lands in a room that is not private (a hall, living space, kitchen, or a room with
 * no classified use), the plan has a front door elsewhere and a private room's door to the
 * outside (a bedroom's garden door) is not reported. Kitchen entry is NOT reported: whether a
 * front door may open into a kitchen is culture-dependent, so a profile may add it later.
 * A storey whose classified rooms are all private (a bedroom drawn alone, a fragment of a
 * dwelling whose "outside" is the rest of the flat) is not reported either.
 * Rooms with no classified use are skipped silently for now (PS2.13 reports coverage).
 */
export const entranceIntoPrivate: LintRule = {
  name: "entrance-into-private",
  check(ctx: LintContext): Diagnostic[] {
    const out: Diagnostic[] = [];
    if (ctx.building.arrivalRooms.length > 0) return out;
    const f = factsOf(ctx);
    const doors = new Map<string, RDoor>(ctx.doors.map((d) => [d.id, d]));
    const balconies = ctx.ir.elements.filter((e): e is ROutdoor => e.kind === "outdoor" && e.surface === "balcony");
    const ways: Array<{ door: RDoor; room: RRoom }> = [];
    for (const e of ctx.access().edges) {
      if (!joins(e) || e.kind !== "door") continue;
      const [a, b] = e.between;
      if ((a === EXTERIOR_NODE) === (b === EXTERIOR_NODE)) continue;
      const room = f.byId.get(a === EXTERIOR_NODE ? b : a);
      const door = doors.get(e.doorId);
      if (!room || !door || doorFacesBalcony(door, ctx.rooms, balconies)) continue;
      ways.push({ door, room });
    }
    if (ways.length === 0 || ways.some((w) => !f.priv.has(w.room.id))) return out;
    // A storey of private rooms alone (a bedroom drawn by itself) is a fragment of a dwelling,
    // not one: its "outside" stands for the rest of the flat, and there is no room to move the
    // front door to.
    if (!ctx.rooms.some((r) => f.uses.get(r.id)!.size > 0 && !f.priv.has(r.id))) return out;
    const tol = ctx.rules.tolMm;
    const order = new Map(ctx.rooms.map((r, i) => [r.id, i]));
    for (const { door, room } of ways) {
      const noun = NOUN[f.priv.get(room.id)!];
      const fact =
        ways.length === 1
          ? `The only door from outside opens into ${quoted(ctx, room)}, a ${noun}.`
          : `The door from outside into ${quoted(ctx, room)} opens into a ${noun}, and no door from outside opens into a hall, living space or kitchen.`;
      // A public room with exterior wall for a front door, from which this room is still reached.
      const cands: Array<{ r: RRoom; run: number; depth: number }> = [];
      for (const h of ctx.rooms) {
        if (h.id === room.id || !hasAny(f.uses.get(h.id)!, PUBLIC_USES) || f.priv.has(h.id)) continue;
        const run = exteriorRunMm(ctx.roomRects.get(h.id)!, ctx.wallSegs, tol);
        if (run < FRONT_DOOR_MM + NIBS_MM) continue;
        const inside = hops(f.g, [], (id) => id === EXTERIOR_NODE, [h.id]);
        const k = inside.get(room.id);
        if (k === undefined) continue;
        cands.push({ r: h, run, depth: k + 1 });
      }
      cands.sort((a, b) => a.depth - b.depth || b.run - a.run || order.get(a.r.id)! - order.get(b.r.id)!);
      const hints = cands
        .slice(0, 3)
        .map(
          (c) =>
            `Move ${door.id} onto ${quoted(ctx, c.r)} (${c.r.id}), which has ${mm(c.run)} mm of exterior wall on ` +
            `centrelines, at least ${FRONT_DOOR_MM} mm wide: ${quoted(ctx, room)} (${room.id}) is then at depth ${c.depth}.`,
        );
      hints.push(
        `${cands.length > 0 ? "Or put" : "Put"} an entrance hall or lobby at least ${ENTRY_LOBBY_MM} mm clear ` +
          `(GB 50096-2011 5.7.1, as advice) between ${door.id} and ${quoted(ctx, room)} (${room.id}).`,
      );
      hints.push(`Accept if ${room.id} is a bedsit or cabin with no separate living space. The warning is advisory.`);
      out.push({
        severity: "warning",
        code: "W_ENTRANCE_INTO_PRIVATE",
        ...ctx.at(door),
        message:
          `${fact} A front door opens into a hall, living space or kitchen, never straight into a bedroom, bathroom ` +
          "or WC (Alexander patterns 112 and 130; ResPlan: 0 of 16,317 front doors).",
        hints,
      });
    }
    return out;
  },
};
