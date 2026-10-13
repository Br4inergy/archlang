/**
 * **`schedule openings`** — the door and window TAGS drawn beside each opening, and the rows
 * of the DOOR & WINDOW SCHEDULE table the sheet carries (`sheet-tables.ts` lays the table
 * out and lowers it; this module derives what it says and where each tag sits).
 *
 * Opt-in like every sheet table: a plan that does not write `schedule openings` never calls
 * anything here, so its drawing is byte-identical. Presentation only — `describe()` and
 * `lint()` never read it; every fact the table prints is already in `describe().doors[]` /
 * `windows[]` (the rooms, by the same derivation) or in the source (width, kind).
 *
 * **Rows are derived, never authored** (ADR 0005). Doors are tagged `D01, D02, …` and
 * windows `W01, W02, …` in element order, per storey (each page tabulates its own openings,
 * as `schedule rooms` does); the number is zero-padded to a uniform width.
 *
 * **A tag's position comes from the opening's shape and its host wall** — never a bounding
 * box or a centroid. Each side of the wall is probed one wall thickness off the centreline
 * (`wallFaceProbes`) and asked whether it is floor (the room/void rings, `pointInRoomBox`):
 *
 * - A **window** tag sits centred on the window, just off the face that HAS floor — inside
 *   the building, so it can never meet a `dims auto` chain (every chain is outside) or the
 *   sill nose (drawn on the face with no floor).
 * - A **door** tag sits BESIDE the doorway, never in front of it: past one jamb, just off a
 *   wall face. That keeps it out of the passage (the doorway's clear zone) on both sides and
 *   clear of the leaf's quarter-disc by construction — the disc is centred on the hinge with
 *   the opening's width as radius, so it reaches along the wall exactly to the far jamb and
 *   never behind the hinge. The face is one with floor that the door does not draw into
 *   (a hinged leaf, a barn panel, a bifold, a garage projection all occupy the `swing` face);
 *   the jamb is the hinge jamb, or for a non-hinged kind the jamb opposite where the panel
 *   parks.
 *
 * Those are the FIRST choices. A tag must also clear every other opening on its wall (its
 * span along the wall, out to its width — the passage and a leaf's quarter-disc — past each
 * face, or a thickness for a window) and every tag already placed there, so each tag tries
 * its candidates in order (a door: both jambs on its preferred face, then on the other face;
 * a window: centred, then beside each jamb, then the other face) and takes the first that is
 * clear, or the one with the fewest conflicts when none is.
 *
 * What it does not do: avoid furniture, or a perpendicular wall (and the openings and tags
 * on it) within a tag's width of the jamb. That is a general collision pass, not a
 * derivation from the opening.
 *
 * Text is ASCII (`D01`, `hinged`, `left`, a dash for "none"), so the PNG backend's bundled
 * font draws all of it; numbers print through {@link fmt2}.
 */

import type { Point } from "./ast.js";
import type { RDoor, ResolvedElement, ROpening, RRoom, RVoid, RWindow } from "./ir.js";
import type { RenderSizes, SceneNode } from "./scene.js";
import type { Theme } from "./theme.js";
import { add, doorSwing, mul, normal, segmentDirAt, sub, wallFaceProbes } from "./geometry.js";
import { connectorConnection, DEFAULT_TOL, EXTERIOR_NODE, pointInRoomBox, type RoomBox, roomBox } from "./analyze.js";
import { textWidth } from "./text-metrics.js";
import { fmt2 } from "./num-format.js";

/** One DOOR & WINDOW SCHEDULE line. Every cell is the string drawn. */
export interface OpeningRow {
  /** `D01…` / `W01…` — the tag drawn beside the opening. */
  tag: string;
  kind: "door" | "window";
  /** The opening's resolved id (not drawn; the handle back to `describe()`). */
  id: string;
  /** The room(s) it opens onto, by name (`label`, else id), joined by ` / `; `exterior`
   *  for the outside; `-` when it sits on no room edge. */
  rooms: string;
  /** Nominal width in mm, through {@link fmt2}. */
  width: string;
  /** A door's kind (`hinged` when none was written); `window` for a window. */
  type: string;
  /** A hinged door's hand (`left`/`right`, see {@link doorHand}); `-` otherwise. */
  hand: string;
}

/** The doors and windows a storey tags, each list in element order. */
function taggable(elements: readonly ResolvedElement[]): { doors: RDoor[]; windows: RWindow[] } {
  return {
    doors: elements.filter((e): e is RDoor => e.kind === "door"),
    windows: elements.filter((e): e is RWindow => e.kind === "window"),
  };
}

/** How many tags (and table rows) a storey's `schedule openings` draws. */
export function openingCount(elements: readonly { kind: string }[]): number {
  let n = 0;
  for (const e of elements) if (e.kind === "door" || e.kind === "window") n++;
  return n;
}

/** `prefix` + 1-based index, zero-padded to the list's uniform width (`D01 … D09`, `D001 …`). */
const tagOf = (prefix: string, i: number, count: number): string =>
  prefix + String(i + 1).padStart(Math.max(2, String(count).length), "0");

/**
 * A hinged door's HAND, read off the leaf's own geometry: stand on the side the door opens
 * INTO, face the door, and the hinge is on your `left` or your `right` (EN 12519 / DIN 107,
 * read from the pull side; North American ANSI/BHMA handing reads from the push side, so an
 * inswing door's hand is the other word there). It is NOT the `hinge left|right` clause, which is measured along the
 * host wall's traversal and so flips with the order a wall's points were written in; this
 * reads the drawn leaf, so it changes exactly when the drawing does — a mirrored `place`
 * swaps it, a rotation does not. `null` for a door with no swing (unhosted, or a non-hinged
 * kind).
 */
export function doorHand(d: RDoor): "left" | "right" | null {
  const s = doorSwing(d);
  if (!s) return null;
  // Facing the door from the swing side is facing -leaf; on a y-down page the viewer's
  // right of a facing `f` is `(-f.y, f.x)`.
  const leaf = sub(s.leafEnd, s.hinge);
  const right = { x: leaf.y, y: -leaf.x };
  const h = sub(s.hinge, d.at);
  return h.x * right.x + h.y * right.y > 0 ? "right" : "left";
}

/** The rooms (and voids) whose floors the probes test, in element order. */
function floorBoxes(elements: readonly ResolvedElement[]): RoomBox[] {
  return elements.filter((e): e is RRoom | RVoid => e.kind === "room" || e.kind === "void").map(roomBox);
}

/** Index of the first floor ring holding `p`, or -1 when `p` is on no floor. */
function floorIndex(p: Point, boxes: readonly RoomBox[]): number {
  for (let i = 0; i < boxes.length; i++) if (pointInRoomBox(p, boxes[i]!)) return i;
  return -1;
}

/** Derive the schedule rows for one storey: doors first, then windows, each in element order. */
export function openingRows(elements: readonly ResolvedElement[]): OpeningRow[] {
  const { doors, windows } = taggable(elements);
  const rooms = elements.filter((e): e is RRoom => e.kind === "room");
  const roomRects = new Map<string, RoomBox>(rooms.map((r) => [r.id, roomBox(r)]));
  const nameOf = new Map(rooms.map((r) => [r.id, r.label ?? r.id]));
  const named = (ids: readonly string[]): string =>
    ids.length === 0 ? "-" : ids.map((id) => nameOf.get(id) ?? id).join(" / ");
  const rows: OpeningRow[] = doors.map((d, i) => ({
    tag: tagOf("D", i, doors.length),
    kind: "door",
    id: d.id,
    rooms: named(connectorConnection(d, roomRects, DEFAULT_TOL).between),
    width: fmt2(d.width),
    type: d.doorKind ?? "hinged",
    hand: doorHand(d) ?? "-",
  }));
  windows.forEach((w, i) => {
    // The rooms either side, by the doors' own derivation: an exterior window lists its one
    // room (the outside is not a room it serves), an interior window on a shared wall both.
    // The first is `describe().windows[].room`, except where three or more rooms meet at the
    // window and the face probe decides which two it joins.
    const between = connectorConnection(w, roomRects, DEFAULT_TOL).between.filter((id) => id !== EXTERIOR_NODE);
    rows.push({
      tag: tagOf("W", i, windows.length),
      kind: "window",
      id: w.id,
      rooms: named(between),
      width: fmt2(w.width),
      type: "window",
      hand: "-",
    });
  });
  return rows;
}

/** Primitives one tag draws: its frame (a door's circle, a window's box) and its text. */
export const TAG_PRIMITIVES = 2;

/** A tag's text size: the dimension font, so a tag reads at the weight a dimension does. */
const tagFont = (sizes: RenderSizes): number => sizes.dimFont;

/** The tag frame's half-extents: a door's circle radius / a window's box half-width and
 *  half-height, sized to the text so it never crosses it. */
function tagFrame(text: string, fs: number): { r: number; hw: number; hh: number } {
  const half = textWidth(text, fs) / 2 + fs * 0.35;
  return { r: Math.max(half, fs * 0.9), hw: half, hh: fs * 0.8 };
}

/**
 * What a tag must stay off, for one opening, in that opening's own frame: `u` along its
 * wall (the tangent at the opening), `v` across it (the left normal). The zone spans the
 * opening along the wall — and, for a `barn` door, the panel parked beside it on the
 * `slide` side — and reaches `reach` past the wall's centreline on both faces: an opening's
 * width for a door or a cased opening (the passage, and a hinged leaf's quarter-disc, whose
 * radius is that width), one wall thickness for a window (its sill nose).
 */
interface Zone {
  at: Point;
  dir: Point;
  n: Point;
  lo: number;
  hi: number;
  reach: number;
  /** The opening it belongs to — a window's own zone is not an obstacle to its own tag,
   *  which sits in front of it by design. */
  owner: ResolvedElement;
}

function zoneOf(o: RDoor | RWindow | ROpening): Zone | null {
  const seg = o.host;
  if (!seg) return null;
  const dir = segmentDirAt(seg, o.at);
  const hw = o.width / 2;
  let lo = -hw;
  let hi = hw;
  if (o.kind === "door" && o.doorKind === "barn") {
    if (o.slide === "right") hi += o.width;
    else lo -= o.width;
  }
  const reach = seg.thickness / 2 + (o.kind === "window" ? seg.thickness : o.width);
  return { at: o.at, dir, n: normal(dir), lo, hi, reach, owner: o };
}

/** An axis-aligned box a placed tag occupies (a circle's bounding square, or the box). */
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Does a tag centred at `c`, reaching `ext(u)` along any unit `u`, touch the zone? Tested
 *  in the zone's own frame — exact for a window's box and conservative for a door's circle. */
function hitsZone(c: Point, ext: (u: Point) => number, z: Zone): boolean {
  const d = sub(c, z.at);
  const u = d.x * z.dir.x + d.y * z.dir.y;
  const v = d.x * z.n.x + d.y * z.n.y;
  const eu = ext(z.dir);
  const ev = ext(z.n);
  return u + eu > z.lo && u - eu < z.hi && Math.abs(v) - ev < z.reach;
}

const boxesOverlap = (a: Box, b: Box): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * The candidate centres for one tag, in preference order — see the module header for the
 * rule that orders them. A window: centred on its floor face, then beside each jamb on that
 * face, then centred on the other face. A door: beside its preferred jamb on its preferred
 * face, then the other jamb, then the same two on the other face. `ext(u)` is how far the
 * tag's frame reaches along the unit `u`, so every stand-off is exact at any wall angle.
 */
function tagCandidates(o: RDoor | RWindow, boxes: readonly RoomBox[], ext: (u: Point) => number, gap: number): Point[] {
  const seg = o.host;
  if (!seg) return [o.at];
  const dir = segmentDirAt(seg, o.at);
  const n = normal(dir);
  const h = seg.thickness / 2;
  const { plus, minus } = wallFaceProbes(seg, o.at, Math.max(seg.thickness, 1));
  const fPlus = floorIndex(plus, boxes);
  const fMinus = floorIndex(minus, boxes);
  // Sides as signs of `n`. The floor side: the one with floor, or — floor on both — the one
  // whose room comes first in element order (a fact `place` carries unchanged); `-n` when
  // neither has floor or both are the same room.
  const hasFloor = (s: 1 | -1): boolean => (s > 0 ? fPlus : fMinus) >= 0;
  const floorSide: 1 | -1 = fPlus >= 0 && (fMinus < 0 || fPlus < fMinus) ? 1 : -1;
  const standOff = (s: 1 | -1): Point => mul(n, s * (h + gap + ext(mul(n, s))));
  const beside = (a: 1 | -1): Point => mul(dir, a * (o.width / 2 + gap + ext(dir)));

  if (o.kind === "window") {
    const off = standOff(floorSide);
    return [
      add(o.at, off),
      add(add(o.at, beside(-1)), off),
      add(add(o.at, beside(1)), off),
      add(o.at, standOff(floorSide === 1 ? -1 : 1)),
    ];
  }

  // A door: the face it draws INTO (a hinged leaf, a barn panel, a bifold, a garage
  // projection — all on the `swing` face, as `door.render` draws them), if any. Prefer a
  // floor face it leaves free, then the floor face it occupies, then the free face.
  const kind = o.doorKind ?? "hinged";
  const occupied: 1 | -1 | 0 = kind === "sliding" || kind === "pocket" ? 0 : o.swing === "in" ? 1 : -1;
  let side: 1 | -1;
  if (occupied === 0) side = floorSide;
  else {
    const free = occupied === 1 ? -1 : 1;
    side = hasFloor(free) ? free : hasFloor(occupied) ? occupied : free;
  }
  // The jamb: the hinge jamb, or for a non-hinged kind the one opposite where its panel
  // parks (`slide`, measured along the traversal exactly as `hinge` is).
  const along: 1 | -1 = kind === "hinged" ? (o.hinge === "left" ? -1 : 1) : o.slide === "right" ? -1 : 1;
  const flip: 1 | -1 = along === 1 ? -1 : 1;
  const other: 1 | -1 = side === 1 ? -1 : 1;
  return [
    add(add(o.at, beside(along)), standOff(side)),
    add(add(o.at, beside(flip)), standOff(side)),
    add(add(o.at, beside(along)), standOff(other)),
    add(add(o.at, beside(flip)), standOff(other)),
  ];
}

/**
 * The tags' Scene primitives for one storey, on the `annotations` pass: per door a circle
 * and its tag, per window a box and its tag — {@link TAG_PRIMITIVES} each, which is what the
 * drawing budget counts.
 *
 * Each tag takes the FIRST of its candidates that touches no opening's zone on its own wall
 * (every door, window and cased opening there — its own included, except a window's) and no
 * tag already placed; when none is clear it takes the one with the fewest such conflicts,
 * the earliest on a tie. Tags are placed doors first, then windows, each in element order.
 */
export function openingTagNodes(elements: readonly ResolvedElement[], theme: Theme, sizes: RenderSizes): SceneNode[] {
  const { doors, windows } = taggable(elements);
  const boxes = floorBoxes(elements);
  const fs = tagFont(sizes);
  const gap = fs * 0.4;
  const ink = theme.annotation;
  const out: SceneNode[] = [];

  // Every opening's zone, grouped by its host wall: a tag only ever stands off its own
  // wall's faces, so only that wall's openings can lie under it.
  const zonesByWall = new Map<string, Zone[]>();
  for (const e of elements) {
    if (e.kind !== "door" && e.kind !== "window" && e.kind !== "opening") continue;
    const o = e as RDoor | RWindow | ROpening;
    const z = zoneOf(o);
    if (!z || !o.host) continue;
    const list = zonesByWall.get(o.host.wallId);
    if (list) list.push(z);
    else zonesByWall.set(o.host.wallId, [z]);
  }
  // Tags already placed, by wall too: two walls' tags meet only where the walls do, which is
  // the perpendicular-wall case this pass does not take on (and keeping the scan per wall
  // keeps it linear in walls rather than quadratic in every opening of the storey).
  const placedByWall = new Map<string, Box[]>();
  const place = (o: RDoor | RWindow, ext: (u: Point) => number, halfX: number, halfY: number): Point => {
    const wallId = o.host?.wallId ?? "";
    const zones = zonesByWall.get(wallId) ?? [];
    let placed = placedByWall.get(wallId);
    if (!placed) {
      placed = [];
      placedByWall.set(wallId, placed);
    }
    let best: Point = o.at;
    let bestHits = Number.POSITIVE_INFINITY;
    for (const c of tagCandidates(o, boxes, ext, gap)) {
      const box = { x0: c.x - halfX, y0: c.y - halfY, x1: c.x + halfX, y1: c.y + halfY };
      let hits = 0;
      for (const z of zones) if (!(o.kind === "window" && z.owner === o) && hitsZone(c, ext, z)) hits++;
      for (const b of placed) if (boxesOverlap(box, b)) hits++;
      if (hits < bestHits) {
        best = c;
        bestHits = hits;
        if (hits === 0) break;
      }
    }
    placed.push({ x0: best.x - halfX, y0: best.y - halfY, x1: best.x + halfX, y1: best.y + halfY });
    return best;
  };

  const text = (at: Point, value: string): SceneNode => ({
    layer: "annotations",
    prim: { t: "text", at, value, size: fs, anchor: "middle", baseline: "central" },
    paint: { fill: ink },
  });
  doors.forEach((d, i) => {
    const tag = tagOf("D", i, doors.length);
    const { r } = tagFrame(tag, fs);
    const c = place(d, () => r, r, r);
    out.push({
      layer: "annotations",
      prim: { t: "circle", center: c, r },
      paint: { fill: "none", stroke: ink, width: sizes.thin },
      lineWeight: "thin",
    });
    out.push(text(c, tag));
  });
  windows.forEach((w, i) => {
    const tag = tagOf("W", i, windows.length);
    const { hw, hh } = tagFrame(tag, fs);
    const c = place(w, (u) => Math.abs(u.x) * hw + Math.abs(u.y) * hh, hw, hh);
    out.push({
      layer: "annotations",
      prim: {
        t: "polygon",
        pts: [
          { x: c.x - hw, y: c.y - hh },
          { x: c.x + hw, y: c.y - hh },
          { x: c.x + hw, y: c.y + hh },
          { x: c.x - hw, y: c.y + hh },
        ],
      },
      paint: { fill: "none", stroke: ink, width: sizes.thin },
      lineWeight: "thin",
    });
    out.push(text(c, tag));
  });
  return out;
}
