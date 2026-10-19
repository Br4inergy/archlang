/**
 * A storey's ways in from outside, and its MAIN entrance (plan-soundness PS0.10).
 *
 * Reachability and the circulation walk start from every exterior connector at once, so a
 * patio or balcony door used to hide a route blocked from the front door: on the first-contact
 * audit's townhouse a sofa across the hall-to-living opening left Living and the kitchen
 * reachable only through the garden, and lint was silent until the patio door was turned into a
 * window (`docs/plans/plan-soundness/audits/2026-10-18-first-contact.md` T2; A2 is the same mask
 * through a balcony door). This module names the front door as a fact, and says which ways in a
 * walk is judged from. It is the one place a storey's ways in are classified: the circulation
 * rules and the privacy rules (`src/lint/rules/privacy.ts`) both read it.
 *
 * **The choice, and when it is refused** (ADR 0005: report the ambiguity, never guess; a
 * deterministic bad heuristic is still an arranger, so WIDTH never decides: a wider back or
 * delivery door is not a front door). The candidates are the storey's exterior DOORS (a leaf: a
 * cased opening is not a front door) that are not a `garage` door and do not open onto an
 * `outdoor balcony` ({@link doorFacesBalcony}). Each step must single out exactly one door, or
 * the next step is asked:
 *  0. One candidate: it is the only door from the ground (`sole`).
 *  1. The candidates opening into an entrance space: a room whose uses ({@link roomUses}) include
 *     entry, hall or circulation and no private or service use (`entry-room`). Of several, step 2
 *     is asked of those alone.
 *  2. With `site`, the HINGED candidates whose wall faces `site.street`: the outward side of the
 *     host wall, probed one wall thickness off each face (the side whose probe is on no room's
 *     floor), turned by `north` (`street`). A slider on the street is a shop front or a patio
 *     door as often as a front door, so it is never chosen here.
 *  3. Otherwise refused: `tie` (the doors nothing singled out are listed), or `no-candidate`.
 * A storey a shaft arrives on from below names none (`upper-storey`): which of its exterior doors
 * is a way in at all is PS0.3's question. A refusal keeps every way in, exactly as before, and
 * the fact still says why.
 *
 * **The ways a walk keeps** ({@link walkWays}): the main entrance; every `garage` door (a
 * vehicle entrance by its authored kind: whoever arrives by car starts there); and every other
 * exterior connector whose room the doors do NOT connect to the main entrance without going
 * outside (a store reached only by its own door keeps that door). A living room reached from
 * the hall loses its patio or balcony door as a way in, so its walk is measured from the front
 * door. Which rooms the door graph reaches is unchanged by construction (every room reached
 * from any entrance is reached from the ways kept), so `W_ROOM_UNREACHABLE` cannot move; only
 * the walk can.
 */

import { bestPaths } from "../algebra/paths.js";
import { MIN_PLUS } from "../algebra/semiring.js";
import { northQuarterTurns } from "../algebra/d4.js";
import {
  accessDigraph,
  type AccessEdge,
  type AccessGraph,
  accessGraphOf,
  type AccessRoomNode,
  doorFacesBalcony,
  EXTERIOR_NODE,
  type MainEntranceFact,
  pointInRoomBox,
  type RoomBox,
  roomUses,
} from "../analyze.js";
import type { UseKind } from "../ast.js";
import { wallFaceProbes } from "../geometry.js";
import type { RDoor, ROpening, ROutdoor, RRoom, ResolvedPlan } from "../ir.js";
import { type CompassLetter, deriveSite, toCompass } from "../site.js";

/** What this module reads off one storey. */
export interface EntranceInputs {
  rooms: readonly RRoom[];
  doors: readonly RDoor[];
  openings: readonly ROpening[];
  outdoors: readonly ROutdoor[];
  roomRects: ReadonlyMap<string, RoomBox>;
  site: ResolvedPlan["site"];
  north: ResolvedPlan["north"];
  /** A shaft arrives on this storey from a storey below (`levelsEnteredFromBelow`): it names
   *  no main entrance (basis `upper-storey`), and its walk keeps every way in. */
  upperStorey?: boolean;
}

/** The {@link EntranceInputs} of a resolved storey. */
export function entranceInputs(
  ir: ResolvedPlan,
  roomRects: ReadonlyMap<string, RoomBox>,
  upperStorey = false,
): EntranceInputs {
  return {
    rooms: ir.elements.filter((e): e is RRoom => e.kind === "room"),
    doors: ir.elements.filter((e): e is RDoor => e.kind === "door"),
    openings: ir.elements.filter((e): e is ROpening => e.kind === "opening"),
    outdoors: ir.elements.filter((e): e is ROutdoor => e.kind === "outdoor"),
    roomRects,
    site: ir.site,
    north: ir.north,
    ...(upperStorey ? { upperStorey } : {}),
  };
}

/** One way in from outside: an entrance edge of the access graph. */
export interface EntranceWay {
  doorId: string;
  /** The room it opens into. */
  room: string;
  kind: AccessEdge["kind"];
  /** It opens onto an `outdoor balcony`, not the ground ({@link doorFacesBalcony}). */
  balcony: boolean;
}

/** Every entrance edge of `graph`, in edge order, with the room it opens into. */
export function entranceWays(graph: AccessGraph, inp: EntranceInputs): EntranceWay[] {
  const balconies = inp.outdoors.filter((o) => o.surface === "balcony");
  const connectors = new Map<string, RDoor | ROpening>([...inp.doors, ...inp.openings].map((c) => [c.id, c]));
  const ids = new Set(graph.entrances);
  const out: EntranceWay[] = [];
  for (const e of graph.edges) {
    if (!ids.has(e.doorId)) continue;
    const room = e.between[0] === EXTERIOR_NODE ? e.between[1] : e.between[0];
    const c = connectors.get(e.doorId);
    out.push({ doorId: e.doorId, room, kind: e.kind, balcony: c ? doorFacesBalcony(c, inp.rooms, balconies) : false });
  }
  return out;
}

/** The compass side a door's wall faces outward, from the shape, or `null` when both faces or
 *  neither are on a room's floor. */
function doorFacing(d: RDoor, roomRects: ReadonlyMap<string, RoomBox>, turns: 0 | 1 | 2 | 3): CompassLetter | null {
  if (!d.host) return null;
  const { n, plus, minus } = wallFaceProbes(d.host, d.at, Math.max(d.host.thickness, 1));
  const on = (p: { x: number; y: number }): boolean => {
    for (const b of roomRects.values()) if (pointInRoomBox(p, b)) return true;
    return false;
  };
  const onPlus = on(plus);
  if (onPlus === on(minus)) return null;
  // Outward is the side with no floor on it; a 45° wall reads N/S, as a window's does.
  const ox = (onPlus ? -1 : 1) * n.x;
  const oy = (onPlus ? -1 : 1) * n.y;
  const page: CompassLetter = Math.abs(oy) >= Math.abs(ox) ? (oy < 0 ? "N" : "S") : ox < 0 ? "W" : "E";
  return toCompass(page, turns);
}

/** A door with a hinged leaf: the default kind, or `hinged` written out. */
const hinged = (d: RDoor): boolean => d.doorKind === undefined || d.doorKind === "hinged";

/** Uses that make a room an entrance space: a hall, an entry or circulation. */
const ENTRY_USES: ReadonlySet<UseKind> = new Set<UseKind>(["entry", "hall", "circulation"]);
/** Uses that make a room private or service, never a front door's room whatever else it is. */
const NOT_ENTRY_USES: ReadonlySet<UseKind> = new Set<UseKind>([
  "bedroom",
  "bath",
  "wc",
  "storage",
  "utility",
  "garage",
]);

/** Does the room read as an entrance space ({@link roomUses}): an entry, hall or circulation
 *  use, and no private or service use beside it? */
function isEntryRoom(r: RRoom | undefined): boolean {
  if (!r) return false;
  const uses = roomUses(r);
  return [...uses].some((u) => ENTRY_USES.has(u)) && ![...uses].some((u) => NOT_ENTRY_USES.has(u));
}

/**
 * The storey's main entrance ({@link MainEntranceFact}; the rule is this module's header), or
 * `null` on a storey with one entrance or none: there is nothing to choose, and no fact.
 * Width never decides: a wider back or delivery door is not a front door.
 */
export function mainEntranceOf(graph: AccessGraph, inp: EntranceInputs): MainEntranceFact | null {
  if (graph.entrances.length <= 1) return null;
  // PS0.3: an upper storey's exterior doors open onto decks and terraces; which of them is a
  // way in at all is that card's question, so the fact is not asked here.
  if (inp.upperStorey === true) return { door: null, basis: "upper-storey", candidates: [] };
  const doors = new Map(inp.doors.map((d) => [d.id, d]));
  const rooms = new Map(inp.rooms.map((r) => [r.id, r]));
  const cands: Array<{ door: RDoor; room: string }> = [];
  for (const w of entranceWays(graph, inp)) {
    const d = doors.get(w.doorId);
    if (w.kind === "door" && d && d.doorKind !== "garage" && !w.balcony) cands.push({ door: d, room: w.room });
  }
  const ids = (cs: readonly { door: RDoor }[]): string[] => cs.map((c) => c.door.id);
  if (cands.length === 0) return { door: null, basis: "no-candidate", candidates: [] };
  // The only door from the ground there is: nothing is chosen.
  if (cands.length === 1) return { door: cands[0]!.door.id, basis: "sole", candidates: ids(cands) };
  // (a) The door into an entrance space.
  const entry = cands.filter((c) => isEntryRoom(rooms.get(c.room)));
  if (entry.length === 1) return { door: entry[0]!.door.id, basis: "entry-room", candidates: ids(entry) };
  const pool = entry.length > 1 ? entry : cands;
  // (b) The hinged door on the street side, within the doors (a) left.
  if (inp.site) {
    const turns = northQuarterTurns(inp.north);
    const street = deriveSite(inp.site).street;
    const onStreet = pool.filter((c) => hinged(c.door) && doorFacing(c.door, inp.roomRects, turns) === street);
    if (onStreet.length === 1) return { door: onStreet[0]!.door.id, basis: "street", candidates: ids(onStreet) };
    if (onStreet.length > 1) return { door: null, basis: "tie", candidates: ids(onStreet) };
  }
  // (c) Nothing singles one door out.
  return { door: null, basis: "tie", candidates: ids(pool) };
}

/** Door hops from the entrance `door` (its room is 1) without going outside, per room. */
export function depthFromDoor(graph: AccessGraph, door: string): ReadonlyMap<string, number> {
  const e = graph.edges.find((x) => x.doorId === door);
  const room = e ? (e.between[0] === EXTERIOR_NODE ? e.between[1] : e.between[0]) : undefined;
  if (room === undefined || room === "") return new Map();
  const g = accessDigraph(
    graph.rooms.map((r) => r.id),
    graph.edges,
  );
  return bestPaths(g, {
    s: MIN_PLUS,
    weight: () => 1,
    sources: [[room, 1]],
    admit: (n: string) => n !== EXTERIOR_NODE,
    rank: () => 0,
  }).value;
}

/**
 * `describe().access` with the main-entrance facts appended: `mainEntrance`, and, when it names
 * a door, `depthFromMainEntrance` on every room. `graph` itself (the same object, so the same
 * bytes) on a storey with one entrance or none.
 */
export function withMainEntrance(graph: AccessGraph, inp: EntranceInputs): AccessGraph {
  const fact = mainEntranceOf(graph, inp);
  if (fact === null) return graph;
  if (fact.door === null) return { ...graph, mainEntrance: fact };
  const depth = depthFromDoor(graph, fact.door);
  const rooms: AccessRoomNode[] = graph.rooms.map((r) => ({ ...r, depthFromMainEntrance: depth.get(r.id) ?? null }));
  return { ...graph, rooms, mainEntrance: fact };
}

/**
 * The ways in a walk is judged from (this module's header): the main entrance and every other
 * entrance whose room the main entrance does not reach without going outside. `null` — every
 * way in — when no main entrance is named.
 */
export function walkWays(
  graph: AccessGraph,
  inp: EntranceInputs,
  fact: MainEntranceFact | null = mainEntranceOf(graph, inp),
): ReadonlySet<string> | null {
  if (fact === null || fact.door === null) return null;
  const depth = depthFromDoor(graph, fact.door);
  const garage = new Set(inp.doors.filter((d) => d.doorKind === "garage").map((d) => d.id));
  const keep = new Set<string>();
  for (const w of entranceWays(graph, inp))
    if (w.doorId === fact.door || garage.has(w.doorId) || !depth.has(w.room)) keep.add(w.doorId);
  return keep;
}

/**
 * `graph` with only the entrance edges `keep` names: the access graph a walk is judged on.
 * Every other edge stays, so the rooms it reaches are `graph`'s whenever `keep` is
 * {@link walkWays}' answer. `graph` itself when `keep` is `null`.
 */
export function walkAccessGraph(graph: AccessGraph, keep: ReadonlySet<string> | null): AccessGraph {
  if (keep === null) return graph;
  const entrances = new Set(graph.entrances);
  return accessGraphOf(
    graph.rooms.map((r) => r.id),
    graph.edges.filter((e) => !entrances.has(e.doorId) || keep.has(e.doorId)),
  );
}
