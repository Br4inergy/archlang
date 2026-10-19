/**
 * **Walled faces** — the closed regions of floor a storey's wall bodies enclose, and how much
 * of each one the rooms cover (plan-soundness PS2.4: `W_FLOOR_UNASSIGNED`,
 * `W_ROOM_OUTSIDE_SHELL`).
 *
 * A face is a HOLE of the union of every wall's band: the solid the drawing draws for a wall
 * before any opening is cut (`wallBand()` in `src/geometry/band.ts`), joined by the one wall
 * joinery the drawing uses (`joinWallSet` in `src/wall-lowering.ts`). Doors and windows do
 * not cut it, so a room with a door in its wall is still one closed face. The outline's
 * outer loops run with the solid on their right (positive area, clockwise on screen); a hole
 * runs the other way, so a face is an outline loop of negative area. A partition that stops
 * short of the wall it should meet leaves the two sides one face.
 *
 * Every area is measured from the shapes in closed form by the boundary integral of
 * `src/analyze/net-area.ts` ({@link regionBoundary}): wall faces with their true arcs, room
 * rings, and circle rooms as true circles. No tessellation, sampling or bounding box enters a
 * figure; a box only skips a curve that cannot meet the region.
 *
 * **Bounds, all counts and all charged before the work they bound.** The joinery runs only
 * when the storey has at most {@link MAX_FACE_WALL_SEGMENTS} wall segments. The faces are then
 * COUNTED (one signed area per outline loop) before any is measured, and a storey with more
 * than {@link MAX_ENCLOSURE_FACES} is refused whole. Each region measurement reads at most
 * `MAX_NET_CURVES` curves (its pair loop is quadratic in them). Past any bound the face rules
 * say nothing. Under them, every point test ("which face holds this point?", "is it on a
 * wall?") asks only the loops whose cells of a uniform grid ({@link GridIndex}, a filter: the
 * winding number decides) hold the point, so the work per test does not grow with the number
 * of faces; {@link FaceWork} counts it, and a test pins the count.
 *
 * Pure, synchronous, deterministic: the joinery's own determinism, then loops in its output
 * order (sorted, canonical), the grid's own deterministic order, and rooms in source order.
 */

import type { Point } from "../ast.js";
import { distPointToArc } from "../geometry/arc.js";
import { type EdgeLoop, loopArea, loopBBox, loopWinding } from "../geometry/band.js";
import { type GridBox, GridIndex } from "../geometry/grid-index.js";
import { segmentsOfWall } from "../geometry.js";
import { distPointToSegment } from "../geometry/polygon.js";
import type { RRoom, RWall } from "../ir.js";
import { joinWallSet } from "../wall-lowering.js";
import {
  type BoundaryPiece,
  boxesMeet,
  type Curve,
  curvesOfLoop,
  MAX_NET_CURVES,
  type RoomRegion,
  regionBoundary,
  roomRegion,
} from "./net-area.js";

/**
 * The most wall segments a storey may have for its faces to be computed. The joinery splits
 * every band edge against every other it meets, so its work grows with the segment count;
 * the largest shipped plan has well under a tenth of this. A storey past it gets no face
 * rule at all.
 */
export const MAX_FACE_WALL_SEGMENTS = 2000;

/**
 * The most walled faces a storey may have for the face rules to measure it. Every face is
 * measured against the rooms near it, and a room against the faces near it, so the work grows
 * with the face count even with the grid; the largest shipped plan has 18 (`library`). Past
 * it the storey is refused whole, before any face is measured: a wall grid of thousands of
 * cells is a drawing of a lattice, not of rooms, and no answer is better than a slow one.
 */
export const MAX_ENCLOSURE_FACES = 400;

/**
 * The most pairs of wall segments whose bodies' boxes meet (crossings, tees, corners and
 * near-misses) a storey may have before the joinery is run for the face rules. Each such pair
 * is a place the joinery splits edges, and every face of a wall lattice is bounded by such
 * pairs, so this bounds the joinery's work BEFORE it runs: a lattice of more than
 * {@link MAX_ENCLOSURE_FACES} cells is refused here, by counting, without being joined. Four
 * contacts per face is a square cell's own corners; the largest shipped plan has well under
 * a fifth of it.
 */
export const MAX_WALL_CONTACTS = 4 * MAX_ENCLOSURE_FACES;

/** One closed region of floor the walls enclose. */
export interface WallFace {
  /** The hole loop of the wall outline that bounds it. */
  loop: EdgeLoop;
  /** Its box (closed-form, arcs by their extremes) — a filter only. */
  box: GridBox;
  /** The face's floor area (mm²): the hole less any wall standing free inside it. */
  area: number;
  /** The face's boundary curves: its own loop and every outline loop inside its box. */
  curves: Curve[];
}

/**
 * The point tests performed so far: `probes` asks of {@link WallFaces.faceAt} and
 * {@link WallFaces.solid}, `loopTests` the winding numbers taken to answer them. A count, so a
 * test can pin that the work per probe stays flat as the faces multiply.
 */
export interface FaceWork {
  probes: number;
  loopTests: number;
}

/** A storey's walled faces, the joined outline they were read from, and its inside tests. */
export interface WallFaces {
  outline: EdgeLoop[];
  faces: WallFace[];
  /** Is `p` on a wall's solid (nonzero winding over the whole outline)? */
  solid(p: Point): boolean;
  /** The face whose floor holds `p` (the innermost hole around it, off every solid), or -1. */
  faceAt(p: Point): number;
  /** The outline loops whose box meets `box`, in outline order (a filter, never an answer). */
  loopsNear(box: GridBox): EdgeLoop[];
  work: FaceWork;
}

/** Why a storey's faces were not measured: a count over its bound, charged before the work. */
export interface WallFacesRefused {
  refused: "too-many-segments" | "too-many-wall-contacts" | "too-many-faces";
  count: number;
}

const segmentCount = (walls: readonly RWall[]): number =>
  walls.reduce((n, w) => n + (w.closed && w.points.length > 2 ? w.points.length : Math.max(0, w.points.length - 1)), 0);

const inBox = (b: GridBox, p: Point): boolean => p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;

const boxInside = (inner: GridBox, outer: GridBox): boolean =>
  inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minY >= outer.minY && inner.maxY <= outer.maxY;

/**
 * How many pairs of wall segments have bodies whose boxes meet, counted up to `limit + 1` and
 * no further (so the count costs at most that many hits beyond the box tests). A box is the
 * segment's centreline box (an arc's whole circle) grown by half its thickness.
 */
function wallContacts(walls: readonly RWall[], limit: number): number {
  const boxes: GridBox[] = [];
  for (const w of walls)
    for (const s of segmentsOfWall(w)) {
      const h = s.thickness / 2;
      boxes.push(
        s.arc
          ? {
              minX: s.arc.center.x - s.arc.r - h,
              minY: s.arc.center.y - s.arc.r - h,
              maxX: s.arc.center.x + s.arc.r + h,
              maxY: s.arc.center.y + s.arc.r + h,
            }
          : {
              minX: Math.min(s.a.x, s.b.x) - h,
              minY: Math.min(s.a.y, s.b.y) - h,
              maxX: Math.max(s.a.x, s.b.x) + h,
              maxY: Math.max(s.a.y, s.b.y) + h,
            },
      );
    }
  let n = 0;
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) if (boxesMeet(boxes[i]!, boxes[j]!, 0) && ++n > limit) return n;
  return n;
}

/** The grid cell for the loops: the median of their boxes' longer sides (deterministic). */
function cellFor(boxes: readonly GridBox[]): number {
  const sides = boxes.map((b) => Math.max(b.maxX - b.minX, b.maxY - b.minY)).sort((a, b) => a - b);
  const m = sides[Math.floor(sides.length / 2)] ?? 1;
  return Number.isFinite(m) && m > 0 ? m : 1;
}

/**
 * The walled faces of a storey, or `null` when there is nothing to read (no wall, or no wall
 * body that bands), or a {@link WallFacesRefused} when a count is over its bound. A storey
 * whose walls close no region returns an empty `faces`.
 */
export function wallFaces(walls: readonly RWall[]): WallFaces | WallFacesRefused | null {
  if (walls.length === 0) return null;
  const segs = segmentCount(walls);
  if (segs > MAX_FACE_WALL_SEGMENTS) return { refused: "too-many-segments", count: segs };
  // Charged before the joinery: a lattice's crossings are counted, never joined.
  const contacts = wallContacts(walls, MAX_WALL_CONTACTS);
  if (contacts > MAX_WALL_CONTACTS) return { refused: "too-many-wall-contacts", count: contacts };
  // The band before any opening is cut: a door in a wall leaves the face closed.
  const joined = joinWallSet(
    walls.map((w) => ({ ...w, openings: [] })),
    [],
  );
  if (!joined) return null;
  const outline = joined.result.outline;
  const signed = outline.map(loopArea);
  // Charged before any face is measured: one signed area per loop is all this costs.
  const holeCount = signed.filter((a) => a < 0).length;
  if (holeCount > MAX_ENCLOSURE_FACES) return { refused: "too-many-faces", count: holeCount };

  const boxes = outline.map(loopBBox);
  const cell = cellFor(boxes);
  const loopIndex = new GridIndex<number>(cell);
  for (let i = 0; i < outline.length; i++) loopIndex.insert(boxes[i]!, i);
  // Holes, smallest first, so the lowest-numbered one around a point is the innermost.
  const holes = outline
    .map((loop, i) => ({ loop, i, box: boxes[i]!, signed: signed[i]! }))
    .filter((h) => h.signed < 0)
    .sort((a, b) => b.signed - a.signed || a.i - b.i);
  const holeIndex = new GridIndex<number>(cell);
  for (let k = 0; k < holes.length; k++) holeIndex.insert(holes[k]!.box, k);
  const work: FaceWork = { probes: 0, loopTests: 0 };
  const pointBox = (p: Point): GridBox => ({ minX: p.x, minY: p.y, maxX: p.x, maxY: p.y });

  // A point's query box is one cell, so no loop is visited twice (overflow items are never
  // also bucketed): the winding sum counts each loop once.
  const solid = (p: Point): boolean => {
    work.probes++;
    let n = 0;
    loopIndex.forEach(pointBox(p), (i) => {
      if (!inBox(boxes[i]!, p)) return;
      work.loopTests++;
      n += loopWinding(outline[i]!, p);
    });
    return n !== 0;
  };
  const faceAt = (p: Point): number => {
    if (solid(p)) return -1;
    work.probes++;
    let best = -1;
    holeIndex.forEach(pointBox(p), (k) => {
      if (best >= 0 && k >= best) return;
      const h = holes[k]!;
      if (!inBox(h.box, p)) return;
      work.loopTests++;
      if (loopWinding(h.loop, p) !== 0) best = k;
    });
    return best;
  };
  const loopsNear = (box: GridBox): EdgeLoop[] =>
    loopIndex
      .queryBox(box)
      .filter((i) => boxesMeet(boxes[i]!, box, 0))
      .sort((a, b) => a - b)
      .map((i) => outline[i]!);

  const faces: WallFace[] = [];
  for (let k = 0; k < holes.length; k++) {
    const h = holes[k]!;
    const inner = loopIndex
      .queryBox(h.box)
      .filter((i) => i !== h.i && boxInside(boxes[i]!, h.box))
      .sort((a, b) => a - b);
    const curves = [...curvesOfLoop(h.loop), ...inner.flatMap((i) => curvesOfLoop(outline[i]!))];
    const area =
      curves.length > MAX_NET_CURVES
        ? Number.NaN
        : regionBoundary(curves, (p) => faceAt(p) === k, { x: h.box.minX, y: h.box.minY });
    faces.push({ loop: h.loop, box: h.box, area, curves });
  }
  return { outline, faces, solid, faceAt, loopsNear, work };
}

/** The room facts a face measurement reads. */
export type FaceRoom = Pick<RRoom, "id" | "at" | "size" | "poly" | "circle">;

/** What {@link faceCover} measures for one face. */
export interface FaceCover {
  /** The face's floor area (mm²). */
  area: number;
  /** The part of it no room covers (mm²). */
  unassigned: number;
  /** Indices (into the `rooms` given) of the rooms whose edge bounds the unassigned floor. */
  bordering: number[];
}

/**
 * How much of face `fi` no room covers, and which rooms border what is left — or `null`
 * when the face is not measured (too many curves, or a figure out of range).
 */
export function faceCover(wf: WallFaces, fi: number, rooms: readonly FaceRoom[]): FaceCover | null {
  const f = wf.faces[fi]!;
  if (!(f.area > 0)) return null;
  const regions: Array<{ k: number; reg: RoomRegion }> = [];
  rooms.forEach((r, k) => {
    const reg = roomRegion(r);
    if (reg.gross > 0 && boxesMeet(reg.box, f.box, 0)) regions.push({ k, reg });
  });
  const curves = [...f.curves];
  const owner: number[] = f.curves.map(() => -1);
  for (const { k, reg } of regions) {
    for (const c of reg.curves) {
      curves.push(c);
      owner.push(k);
    }
  }
  if (curves.length > MAX_NET_CURVES) return null;
  const bordering = new Set<number>();
  const unassigned = regionBoundary(
    curves,
    (p) => wf.faceAt(p) === fi && !regions.some(({ reg }) => reg.inside(p)),
    { x: f.box.minX, y: f.box.minY },
    (piece: BoundaryPiece) => {
      const k = owner[piece.curve]!;
      if (k >= 0) bordering.add(k);
    },
  );
  const eps = 1e-9 * f.area + 1e-3;
  if (!Number.isFinite(unassigned) || unassigned < -eps || unassigned > f.area + eps) return null;
  return {
    area: f.area,
    unassigned: Math.min(f.area, Math.max(0, unassigned)),
    bordering: [...bordering].sort((a, b) => a - b),
  };
}

/** What {@link roomOutside} measures for one room. */
export interface RoomOutside {
  /** The room's floor area (mm²), from its own shape. */
  gross: number;
  /** The part of it inside some walled face (mm²). */
  inFaces: number;
  /** The part of it off every face and every wall body: outside the building (mm²). */
  area: number;
  /** The farthest room-ring vertex outside, from the nearest wall face (mm); 0 for a circle. */
  depth: number;
}

/**
 * Where a room's floor lies against the walls: how much is inside walled faces and how much is
 * off every face and every wall body (outside the building) — or `null` when it is not
 * measured (too many curves, or a figure out of range).
 */
export function roomOutside(wf: WallFaces, r: FaceRoom): RoomOutside | null {
  const reg = roomRegion(r);
  if (!(reg.gross > 0)) return { gross: 0, inFaces: 0, area: 0, depth: 0 };
  const near = wf.loopsNear(reg.box);
  const curves = [...reg.curves, ...near.flatMap(curvesOfLoop)];
  if (curves.length > MAX_NET_CURVES) return null;
  const off = (p: Point): boolean => !wf.solid(p) && wf.faceAt(p) < 0;
  const origin = { x: reg.box.minX, y: reg.box.minY };
  const area = regionBoundary(curves, (p) => reg.inside(p) && off(p), origin);
  const inFaces = regionBoundary(curves, (p) => reg.inside(p) && wf.faceAt(p) >= 0, origin);
  const eps = 1e-9 * reg.gross + 1e-3;
  for (const v of [area, inFaces]) if (!Number.isFinite(v) || v < -eps || v > reg.gross + eps) return null;
  let depth = 0;
  if (!r.circle) {
    const ring = r.poly ?? [
      { x: r.at.x, y: r.at.y },
      { x: r.at.x + r.size.w, y: r.at.y },
      { x: r.at.x + r.size.w, y: r.at.y + r.size.h },
      { x: r.at.x, y: r.at.y + r.size.h },
    ];
    for (const v of ring) {
      if (!off(v)) continue;
      let d = Number.POSITIVE_INFINITY;
      for (const l of wf.outline)
        for (const e of l) d = Math.min(d, e.t === "line" ? distPointToSegment(v, e.a, e.b) : distPointToArc(v, e.arc));
      if (Number.isFinite(d)) depth = Math.max(depth, d);
    }
  }
  const clamp = (v: number): number => Math.min(reg.gross, Math.max(0, v));
  return { gross: reg.gross, inFaces: clamp(inFaces), area: clamp(area), depth };
}
