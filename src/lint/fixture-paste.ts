/**
 * A pasteable fixture statement for an empty wet room or kitchen (`W_ROOM_NO_FIXTURE`'s hint),
 * placed from the room's own shape and CHECKED before it is quoted.
 *
 * A hint that says "add `furniture wc in bath anchor top flush …`" and lands the WC in the
 * door's swing trades one warning for two. So each candidate is the footprint the resolver
 * would produce for that statement, measured against what the lint rules measure: on the
 * room's floor ({@link rectInRoomBox}, the room's own ring), no wall solid intruded past the
 * collision slack, clear of every door's swing ({@link sectorIntersectsRect}, with the active
 * ruleset's clearance) and doorway landing, clear of other furniture, and with its own frontal
 * use-space free of free-standing furniture. The first candidate that passes is quoted; when
 * none does, the caller says so rather than quote one.
 *
 * Candidates run along each walled edge of the room, back to the wall (so the catalogued depth
 * runs away from it, and the rotation is the one that faces the room):
 *   - a rectangular room uses the `in <room> anchor <a> flush` form, and its footprint is
 *     reproduced with `placeInRoom`'s own arithmetic (`elements/furniture.ts`): the anchored
 *     edge(s) on the inner wall face, the rotation derived from the one anchored edge the
 *     footprint's aspect allows;
 *   - a `polygon` or relational room cannot take `anchor` (E_PLACE_POLY / E_PLACE_REF), so it
 *     gets `at (x,y) … rotate … in <room>` with the coordinates on the plan grid, taken from
 *     the ring's axis-aligned edges and the wall face behind each.
 * Pure, bounded by the room's edge count times the plan's doors, walls and furniture.
 */

import {
  ANCHOR_BACK_EDGES,
  backCandidateEdges,
  FIXTURE_WALL_TOL_MM,
  frontClearanceRect,
  innerFaceOfRoomEdge,
  type RectEdge,
  rectInRoomBox,
  rectOf,
  rotateForBackEdge,
} from "../analyze.js";
import type { FurnitureAnchor } from "../ast.js";
import { frontClearanceMm, requiresWall } from "../fixtures-catalog.js";
import { doorSwing, sectorIntersectsRect } from "../geometry.js";
import { pointInPolygon } from "../geometry/polygon.js";
import { type BBox, doorLandingRect, rectsOverlap, wallIntrusionDepth } from "../geometry/rect.js";
import type { RRoom } from "../ir.js";
import { fmt2 } from "../num-format.js";
import type { LintContext } from "./context.js";

/** The intrusion `W_FURNITURE_WALL_COLLISION` tolerates (its `WALL_COLLISION_SLACK_MM`). */
const SLACK_MM = 30;

/** The anchors tried on each edge: the edge's middle, then its two corners. */
const EDGE_ANCHORS: Readonly<Record<RectEdge, readonly FurnitureAnchor[]>> = {
  top: ["top", "top-left", "top-right"],
  bottom: ["bottom", "bottom-left", "bottom-right"],
  left: ["left", "top-left", "bottom-left"],
  right: ["right", "top-right", "bottom-right"],
};

/** Is `fr` (a fixture of `category` backed onto `edge`) clear of everything the lint measures? */
function isClear(ctx: LintContext, room: RRoom, category: string, fr: BBox, rotate: number): boolean {
  const box = ctx.roomRects.get(room.id);
  if (!box || !rectInRoomBox(fr, box)) return false;
  if (ctx.wallSegs.some((s) => wallIntrusionDepth(fr, s, ctx.wallOpenings) > SLACK_MM)) return false;
  if (ctx.furniture.some((f) => rectsOverlap(fr, rectOf(f)))) return false;
  for (const d of ctx.doors) {
    const s = doorSwing(d);
    if (s && sectorIntersectsRect(s, fr, ctx.rules.swingClearanceMm)) return false;
    const landing = doorLandingRect(d, ctx.rules.doorwayLandingMm);
    if (landing && rectsOverlap(landing, fr)) return false;
  }
  const clearance = frontClearanceMm(category);
  if (clearance > 0) {
    const front = frontClearanceRect({ at: { x: fr.x, y: fr.y }, size: { w: fr.w, h: fr.h }, rotate }, clearance);
    if (ctx.furniture.some((f) => !requiresWall(f.category) && rectsOverlap(front, rectOf(f)))) return false;
  }
  return true;
}

/**
 * The statement that places one `category` fixture clear in `room`, or `null` when no
 * candidate passes. `along`/`depth` are the catalogued footprint.
 */
export function pasteFixture(
  ctx: LintContext,
  room: RRoom,
  category: string,
  along: number,
  depth: number,
): string | null {
  const g = ctx.ir.grid;
  const snap = (v: number) => (g > 0 ? Math.round(v / g) * g : v);
  const A = snap(along);
  const D = snap(depth);
  const sizeOn = (edge: RectEdge) => (edge === "top" || edge === "bottom" ? { w: A, h: D } : { w: D, h: A });
  const face = (rect: BBox, edge: RectEdge) =>
    innerFaceOfRoomEdge(rect, edge, ctx.ir.walls, FIXTURE_WALL_TOL_MM, ctx.wallSegs);

  if (!room.poly && room._rel === undefined) {
    const rect = { x: room.at.x, y: room.at.y, w: room.size.w, h: room.size.h };
    for (const edge of ["top", "bottom", "left", "right"] as const) {
      if (face(rect, edge) === null) continue;
      const { w, h } = sizeOn(edge);
      for (const a of EDGE_ANCHORS[edge]) {
        // The derived rotation needs exactly this edge among the anchored, walled edges the
        // footprint's aspect allows (`placeInRoom`).
        const shape = backCandidateEdges({ w, h }, { along, depth });
        const backed = ANCHOR_BACK_EDGES[a].filter((e) => shape.includes(e) && face(rect, e) !== null);
        if (backed.length !== 1 || backed[0] !== edge) continue;
        const f = (e: RectEdge) => (ANCHOR_BACK_EDGES[a].includes(e) ? face(rect, e) : null);
        const x =
          a === "top-left" || a === "left" || a === "bottom-left"
            ? (f("left") ?? rect.x)
            : a === "top-right" || a === "right" || a === "bottom-right"
              ? (f("right") ?? rect.x + rect.w) - w
              : rect.x + rect.w / 2 - w / 2;
        const y =
          a === "top-left" || a === "top" || a === "top-right"
            ? (f("top") ?? rect.y)
            : a === "bottom-left" || a === "bottom" || a === "bottom-right"
              ? (f("bottom") ?? rect.y + rect.h) - h
              : rect.y + rect.h / 2 - h / 2;
        if (isClear(ctx, room, category, { x, y, w, h }, rotateForBackEdge(edge)))
          return `furniture ${category} in ${room.id} anchor ${a} flush size ${fmt2(w)}x${fmt2(h)}`;
      }
    }
    return null;
  }

  // A ring the room's own: a polygon's vertices, or a relational room's resolved rectangle.
  const ring = room.poly ?? [
    { x: room.at.x, y: room.at.y },
    { x: room.at.x + room.size.w, y: room.at.y },
    { x: room.at.x + room.size.w, y: room.at.y + room.size.h },
    { x: room.at.x, y: room.at.y + room.size.h },
  ];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    const horizontal = p.y === q.y && p.x !== q.x;
    if (!horizontal && !(p.x === q.x && p.y !== q.y)) continue;
    const lo = horizontal ? Math.min(p.x, q.x) : Math.min(p.y, q.y);
    const hi = horizontal ? Math.max(p.x, q.x) : Math.max(p.y, q.y);
    const line = horizontal ? p.y : p.x;
    const mid = (lo + hi) / 2;
    // Which side the floor is on, probed 1 mm off the edge's middle.
    const inward = horizontal
      ? pointInPolygon(mid, line + 1, ring)
        ? 1
        : -1
      : pointInPolygon(line + 1, mid, ring)
        ? 1
        : -1;
    const edge: RectEdge = horizontal ? (inward > 0 ? "top" : "bottom") : inward > 0 ? "left" : "right";
    // A one-millimetre strip with this edge as its `edge` side: the face behind the ring edge.
    const strip = horizontal
      ? { x: lo, y: inward > 0 ? line : line - 1, w: hi - lo, h: 1 }
      : { x: inward > 0 ? line : line - 1, y: lo, w: 1, h: hi - lo };
    const fc = face(strip, edge);
    if (fc === null) continue;
    const { w, h } = sizeOn(edge);
    const span = horizontal ? w : h;
    if (hi - lo < span) continue;
    for (const c of [mid, lo + (hi - lo) / 4, hi - (hi - lo) / 4]) {
      const start = snap(c - span / 2);
      // The face coordinate rounded INTO the room, so snapping never pushes it into the wall.
      const inner = (v: number, up: boolean) => (g > 0 ? (up ? Math.ceil(v / g) * g : Math.floor(v / g) * g) : v);
      const fr = horizontal
        ? { x: start, y: inward > 0 ? inner(fc, true) : inner(fc - h, false), w, h }
        : { x: inward > 0 ? inner(fc, true) : inner(fc - w, false), y: start, w, h };
      const rot = rotateForBackEdge(edge);
      if (isClear(ctx, room, category, fr, rot))
        return `furniture ${category} at (${fmt2(fr.x)},${fmt2(fr.y)}) size ${fmt2(w)}x${fmt2(h)}${rot === 0 ? "" : ` rotate ${rot}`} in ${room.id}`;
    }
  }
  return null;
}
