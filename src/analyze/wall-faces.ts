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
 * **Bounds.** The joinery is run only when the storey has at most
 * {@link MAX_FACE_WALL_SEGMENTS} wall segments, and each measurement reads at most
 * `MAX_NET_CURVES` curves (the pair loop is quadratic in them). Past either bound the face
 * or room is not measured and the rules say nothing about it (refuse, never guess). Both are
 * counts, never a time.
 *
 * Pure, synchronous, deterministic: the joinery's own determinism, then loops in its output
 * order (sorted, canonical) and rooms in source order.
 */

import type { Point } from "../ast.js";
import { loopArea, loopBBox, loopWinding, type EdgeLoop } from "../geometry/band.js";
import { distPointToArc } from "../geometry/arc.js";
import type { GridBox } from "../geometry/grid-index.js";
import { distPointToSegment } from "../geometry/polygon.js";
import type { RRoom, RWall } from "../ir.js";
import { joinWallSet } from "../wall-lowering.js";
import {
  boxesMeet,
  type BoundaryPiece,
  type Curve,
  curvesOfLoop,
  MAX_NET_CURVES,
  regionBoundary,
  type RoomRegion,
  roomRegion,
} from "./net-area.js";

/**
 * The most wall segments a storey may have for its faces to be computed. The joinery splits
 * every band edge against every other it meets, so its work grows with the segment count;
 * the largest shipped plan has well under a tenth of this. A storey past it gets no face
 * rule at all.
 */
export const MAX_FACE_WALL_SEGMENTS = 2000;

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

/** A storey's walled faces, the joined outline they were read from, and its inside tests. */
export interface WallFaces {
  outline: EdgeLoop[];
  faces: WallFace[];
  /** Is `p` on a wall's solid (nonzero winding over the whole outline)? */
  solid(p: Point): boolean;
  /** The face whose floor holds `p` (the innermost hole around it, off every solid), or -1. */
  faceAt(p: Point): number;
}

const segmentCount = (walls: readonly RWall[]): number =>
  walls.reduce((n, w) => n + (w.closed && w.points.length > 2 ? w.points.length : Math.max(0, w.points.length - 1)), 0);

const inBox = (b: GridBox, p: Point): boolean => p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;

const boxInside = (inner: GridBox, outer: GridBox): boolean =>
  inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minY >= outer.minY && inner.maxY <= outer.maxY;

/**
 * The walled faces of a storey, or `null` when there is nothing to read: no wall, a wall
 * set past {@link MAX_FACE_WALL_SEGMENTS}, or no wall body that bands. A storey whose walls
 * close no region returns an empty `faces`.
 */
export function wallFaces(walls: readonly RWall[]): WallFaces | null {
  if (walls.length === 0 || segmentCount(walls) > MAX_FACE_WALL_SEGMENTS) return null;
  // The band before any opening is cut: a door in a wall leaves the face closed.
  const joined = joinWallSet(
    walls.map((w) => ({ ...w, openings: [] })),
    [],
  );
  if (!joined) return null;
  const outline = joined.result.outline;
  const boxes = outline.map(loopBBox);
  const solid = (p: Point): boolean => {
    let n = 0;
    for (let i = 0; i < outline.length; i++) if (inBox(boxes[i]!, p)) n += loopWinding(outline[i]!, p);
    return n !== 0;
  };
  // Holes, smallest first, so the first one around a point is the innermost.
  const holes = outline
    .map((loop, i) => ({ loop, box: boxes[i]!, signed: loopArea(loop) }))
    .filter((h) => h.signed < 0)
    .sort((a, b) => b.signed - a.signed);
  const faceAt = (p: Point): number => {
    if (solid(p)) return -1;
    for (let i = 0; i < holes.length; i++)
      if (inBox(holes[i]!.box, p) && loopWinding(holes[i]!.loop, p) !== 0) return i;
    return -1;
  };
  const faces: WallFace[] = [];
  for (let i = 0; i < holes.length; i++) {
    const h = holes[i]!;
    const curves = [
      ...curvesOfLoop(h.loop),
      ...outline.flatMap((l, k) => (l !== h.loop && boxInside(boxes[k]!, h.box) ? curvesOfLoop(l) : [])),
    ];
    const area =
      curves.length > MAX_NET_CURVES
        ? Number.NaN
        : regionBoundary(curves, (p) => faceAt(p) === i, {
            x: h.box.minX,
            y: h.box.minY,
          });
    faces.push({ loop: h.loop, box: h.box, area, curves });
  }
  return { outline, faces, solid, faceAt };
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
  /** The room's floor outside every face and every wall (mm²). */
  area: number;
  /** The farthest room-ring vertex outside, from the nearest wall face (mm); 0 for a circle. */
  depth: number;
}

/**
 * The part of a room's floor that lies off every walled face and every wall body — outside
 * the building — or `null` when it is not measured (too many curves, or a figure out of
 * range). Only meaningful when the storey has at least one face; the caller asks that.
 */
export function roomOutside(wf: WallFaces, r: FaceRoom): RoomOutside | null {
  const reg = roomRegion(r);
  if (!(reg.gross > 0)) return { area: 0, depth: 0 };
  const near = wf.outline.filter((l) => boxesMeet(loopBBox(l), reg.box, 0));
  const curves = [...reg.curves, ...near.flatMap(curvesOfLoop)];
  if (curves.length > MAX_NET_CURVES) return null;
  const off = (p: Point): boolean => !wf.solid(p) && wf.faceAt(p) < 0;
  const area = regionBoundary(curves, (p) => reg.inside(p) && off(p), {
    x: reg.box.minX,
    y: reg.box.minY,
  });
  const eps = 1e-9 * reg.gross + 1e-3;
  if (!Number.isFinite(area) || area < -eps || area > reg.gross + eps) return null;
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
  return { area: Math.min(reg.gross, Math.max(0, area)), depth };
}
