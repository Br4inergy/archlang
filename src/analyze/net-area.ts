/**
 * **Net internal area** — a room's floor inside the faces of the walls that bound it
 * (`describe().rooms[].net_area_m2`; the rule and why: `docs/adr/0027-net-internal-area.md`).
 *
 * A room is drawn on wall CENTRELINES, so its own area (`area_m2`, {@link
 * import("../analyze.js").roomAreaMm2}) runs to the middle of every wall round it. The net
 * area insets the room's own shape by half the thickness of each wall whose centreline runs
 * along its edge. It is read from the shape and the wall centrelines alone: no bounding box,
 * no centroid, no wall joinery.
 *
 * The rule, exactly:
 *
 * - **A straight edge** (a rectangle's side, a `room polygon`'s edge) is inset, along each
 *   stretch of it, by half the thickness of the thickest STRAIGHT wall segment whose
 *   centreline lies on that stretch of the edge's line (within {@link ON_CENTRELINE_TOL_MM}).
 *   Each wall uses its own thickness, so a shell and a partition inset by different amounts
 *   and a wall shared by two rooms gives each of them half of itself. A stretch no wall runs
 *   along (an open side, a missing partition, the chord of a bay) is inset by zero. Where the
 *   depth changes along one edge the inset steps square at the change.
 * - **Corners.** At a convex corner the two inset lines meet. At an inside (reflex) corner the
 *   band of each wall runs on to the other wall's band, so the corner square both walls
 *   occupy is not floor. That is the inset polygon of the room shape, stated as a region.
 * - **A curved wall never insets a straight edge**: an arc meets a straight edge at most at its
 *   two chord ends or at one tangent point, so it is not the edge's wall. Where a curved wall's
 *   band crosses a straight room edge (a bay whose room stops at the chord) the sliver is not
 *   subtracted.
 * - **A circular room** (`room circle`) is inset, over each angular interval, by half the
 *   thickness of the thickest CONCENTRIC arc wall on its circle there (centre and radius both
 *   within the tolerance): `Σ ½·Δθ·(r − d)²`, which is `π(r − d)²` in closed form when one
 *   thickness walls the whole circle. Straight walls never inset a circle.
 *
 * Two exact procedures implement the one rule. A RECTILINEAR ring (every rectangle) is swept
 * in vertical slabs: the floor in each slab is the room's own intervals less the bands', so
 * every thin room, short stretch and inside corner is exact with no special case. An OBLIQUE
 * ring builds the inset ring (each stretch's line moved in by its depth, neighbours meeting at
 * their lines' intersection, a square step where the depth changes along an edge) and takes
 * its shoelace area. The result is held to `[0, area]`; for an oblique room so thin that its
 * inset lines cross, that clamp is the stated limit of the rule (no shipped plan comes near).
 *
 * Pure, synchronous, deterministic. A circle walled by more than one thickness, or only partly,
 * reads its interval ends through `Math.atan2` (`arcAngleOffset`), which is not exactly rounded
 * across engines; a circle walled all round by one thickness never uses an angle.
 */

import type { Point } from "../ast.js";
import type { WallSegment } from "../geometry.js";
import { arcAngleOffset, fullCircleArc } from "../geometry/arc.js";
import { polygonArea, polygonSignedArea2 } from "../geometry/polygon.js";

/**
 * How far (mm) a wall's centreline may sit off a room edge's line and still be that edge's
 * wall. Rooms are authored on wall centrelines, so this only absorbs float noise in the
 * projection of an oblique edge: one micron, far below any wall thickness or grid.
 */
export const ON_CENTRELINE_TOL_MM = 0.001;

/** The room facts the net area reads: the same shape fields `roomAreaMm2` reads. */
export interface NetAreaRoom {
  at: Point;
  size: { w: number; h: number };
  poly?: readonly Point[];
  circle?: { c: Point; r: number };
}

/** One stretch of an edge: `[lo, hi]` mm along it from its first vertex, inset by `d` mm. */
export interface EdgeStretch {
  lo: number;
  hi: number;
  d: number;
}

/**
 * The room's net internal area in mm² (see the module header for the rule). `segs` are the
 * storey's wall segments (`segmentsOfWall` over every wall); hoist them when measuring many
 * rooms. Never more than the room's own area, never negative.
 */
export function roomNetAreaMm2(r: NetAreaRoom, segs: readonly WallSegment[]): number {
  if (r.circle) return circleNetArea(r.circle.c, r.circle.r, segs);
  // The same gross figure `roomAreaMm2` reports, so `net <= area` holds to the last bit.
  const gross = r.poly ? polygonArea(r.poly) : r.size.w * r.size.h;
  if (!(gross > 0)) return 0;
  const ring = distinctRing(r.poly ?? rectRing(r.at, r.size));
  if (ring.length < 3) return 0;
  const stretches = ringStretches(ring, segs);
  const net = isRectilinear(ring) ? rectilinearNetArea(ring, stretches) : insetRingArea(ring, stretches);
  return Math.min(gross, Math.max(0, net));
}

/** A rectangle's floor as a ring: its four corners clockwise from top-left. */
function rectRing(at: Point, size: { w: number; h: number }): Point[] {
  return [
    { x: at.x, y: at.y },
    { x: at.x + size.w, y: at.y },
    { x: at.x + size.w, y: at.y + size.h },
    { x: at.x, y: at.y + size.h },
  ];
}

/** The ring without repeated consecutive vertices (a zero-length edge has no wall). */
function distinctRing(ring: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p);
  }
  while (out.length > 1 && out[0]!.x === out[out.length - 1]!.x && out[0]!.y === out[out.length - 1]!.y) out.pop();
  return out;
}

const isRectilinear = (ring: readonly Point[]): boolean =>
  ring.every((a, i) => {
    const b = ring[(i + 1) % ring.length]!;
    return a.x === b.x || a.y === b.y;
  });

/** Every edge's stretches, edge `i` running from `ring[i]` to `ring[i + 1]`. */
export function ringStretches(ring: readonly Point[], segs: readonly WallSegment[]): EdgeStretch[][] {
  return ring.map((a, i) => edgeStretches(a, ring[(i + 1) % ring.length]!, segs));
}

/**
 * The edge `a → b` cut into stretches of constant inset depth: half the thickness of the
 * thickest straight wall segment lying on that stretch of the edge's line, else 0. Adjacent
 * stretches of equal depth are merged, so an edge one wall covers is one stretch.
 */
function edgeStretches(a: Point, b: Point, segs: readonly WallSegment[]): EdgeStretch[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const spans: EdgeStretch[] = [];
  for (const s of segs) {
    if (s.arc) continue;
    // Both ends on the edge's line: the segment is collinear with the edge.
    const pa = (s.a.x - a.x) * uy - (s.a.y - a.y) * ux;
    const pb = (s.b.x - a.x) * uy - (s.b.y - a.y) * ux;
    if (Math.abs(pa) > ON_CENTRELINE_TOL_MM || Math.abs(pb) > ON_CENTRELINE_TOL_MM) continue;
    const t1 = (s.a.x - a.x) * ux + (s.a.y - a.y) * uy;
    const t2 = (s.b.x - a.x) * ux + (s.b.y - a.y) * uy;
    const lo = Math.max(0, Math.min(t1, t2));
    const hi = Math.min(len, Math.max(t1, t2));
    if (hi - lo > ON_CENTRELINE_TOL_MM) spans.push({ lo, hi, d: s.thickness / 2 });
  }
  if (spans.length === 0) return [{ lo: 0, hi: len, d: 0 }];
  const cuts = snapCuts(
    spans.flatMap((s) => [s.lo, s.hi]),
    len,
    ON_CENTRELINE_TOL_MM,
  );
  const out: EdgeStretch[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const lo = cuts[i]!;
    const hi = cuts[i + 1]!;
    const mid = (lo + hi) / 2;
    let d = 0;
    for (const s of spans) if (s.lo < mid && mid < s.hi && s.d > d) d = s.d;
    const last = out[out.length - 1];
    if (last && last.d === d) last.hi = hi;
    else out.push({ lo, hi, d });
  }
  return out;
}

/**
 * The cut points of `[0, end]`: `0`, `end` and every interior point, sorted, with any point
 * within `tol` of the one before it dropped (and the last such run ending exactly on `end`).
 * So a wall that ends a float's width short of a corner still reaches it, rather than leaving
 * a sub-micron stretch with no wall that would turn the corner in the inset ring.
 */
function snapCuts(points: readonly number[], end: number, tol: number): number[] {
  const out = [0];
  for (const c of [...points].sort((p, q) => p - q)) {
    if (c - out[out.length - 1]! > tol && end - c > tol) out.push(c);
  }
  out.push(end);
  return out;
}

/** +1 when the ring's interior is on the LEFT of travel (in the plan's own axes), else −1. */
const orientation = (ring: readonly Point[]): number => (polygonSignedArea2(ring) > 0 ? 1 : -1);

/**
 * The exact net area of a RECTILINEAR ring: the room's floor less a band per walled stretch
 * (the stretch moved inward by its depth), each band run on, at an inside corner, by the
 * depth of the neighbouring edge's stretch there. Swept in vertical slabs between every x the
 * ring or a band has; in each slab the floor is the ring's own intervals minus the bands'.
 */
export function rectilinearNetArea(ring: readonly Point[], stretches: readonly EdgeStretch[][]): number {
  const n = ring.length;
  const sigma = orientation(ring);
  const dir = (i: number): { ux: number; uy: number } => {
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    return { ux: Math.sign(b.x - a.x), uy: Math.sign(b.y - a.y) };
  };
  /** Is ring vertex `i` (between edge `i − 1` and edge `i`) an inside corner? */
  const reflex = (i: number): boolean => {
    const p = dir((i + n - 1) % n);
    const q = dir(i);
    return sigma * (p.ux * q.uy - p.uy * q.ux) < 0;
  };
  const bands: { x0: number; x1: number; y0: number; y1: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = ring[i]!;
    const { ux, uy } = dir(i);
    const nx = -uy * sigma;
    const ny = ux * sigma;
    const edge = stretches[i]!;
    const len = edge[edge.length - 1]!.hi;
    for (const s of edge) {
      if (s.d <= 0) continue;
      const before = s.lo === 0 && reflex(i) ? lastDepth(stretches[(i + n - 1) % n]!) : 0;
      const after = s.hi === len && reflex((i + 1) % n) ? stretches[(i + 1) % n]![0]!.d : 0;
      const p0 = { x: a.x + ux * (s.lo - before), y: a.y + uy * (s.lo - before) };
      const p1 = { x: a.x + ux * (s.hi + after), y: a.y + uy * (s.hi + after) };
      const xs = [p0.x, p1.x, p0.x + nx * s.d, p1.x + nx * s.d];
      const ys = [p0.y, p1.y, p0.y + ny * s.d, p1.y + ny * s.d];
      bands.push({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
    }
  }
  const xs = [...new Set([...ring.map((p) => p.x), ...bands.flatMap((b) => [b.x0, b.x1])])].sort((p, q) => p - q);
  let area = 0;
  for (let k = 0; k + 1 < xs.length; k++) {
    const x0 = xs[k]!;
    const x1 = xs[k + 1]!;
    const mx = (x0 + x1) / 2;
    // The ring's floor in this slab: the horizontal edges crossing it, paired in order.
    const ys: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % n]!;
      if (a.y === b.y && Math.min(a.x, b.x) < mx && mx < Math.max(a.x, b.x)) ys.push(a.y);
    }
    if (ys.length < 2) continue;
    ys.sort((p, q) => p - q);
    const cover = mergeIntervals(
      bands.filter((b) => b.x0 < mx && mx < b.x1).map((b): [number, number] => [b.y0, b.y1]),
    );
    let floor = 0;
    for (let j = 0; j + 1 < ys.length; j += 2) floor += ys[j + 1]! - ys[j]! - coveredWithin(cover, ys[j]!, ys[j + 1]!);
    area += (x1 - x0) * floor;
  }
  return area;
}

const lastDepth = (edge: readonly EdgeStretch[]): number => edge[edge.length - 1]!.d;

/** Sort and merge closed intervals into disjoint ones. */
function mergeIntervals(iv: [number, number][]): [number, number][] {
  iv.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const out: [number, number][] = [];
  for (const [lo, hi] of iv) {
    const last = out[out.length - 1];
    if (last && lo <= last[1]) last[1] = Math.max(last[1], hi);
    else out.push([lo, hi]);
  }
  return out;
}

/** Length of `[lo, hi]` covered by the disjoint, sorted intervals `cover`. */
function coveredWithin(cover: readonly [number, number][], lo: number, hi: number): number {
  let c = 0;
  for (const [a, b] of cover) {
    const s = Math.max(a, lo);
    const e = Math.min(b, hi);
    if (e > s) c += e - s;
  }
  return c;
}

/**
 * The shoelace area of the INSET RING: every stretch's line moved inward by its depth,
 * consecutive lines meeting at their intersection, and a square step (two vertices) where the
 * depth changes between two collinear stretches. Signed so a ring the insets turned inside out
 * reads negative; the caller clamps. Works for any simple ring; used for oblique ones.
 */
export function insetRingArea(ring: readonly Point[], stretches: readonly EdgeStretch[][]): number {
  const n = ring.length;
  const sigma = orientation(ring);
  interface Item {
    ex: number;
    ey: number;
    ux: number;
    uy: number;
    nx: number;
    ny: number;
    p0: Point;
    p1: Point;
    d: number;
  }
  const items: Item[] = [];
  for (let i = 0; i < n; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey);
    const ux = ex / len;
    const uy = ey / len;
    const edge = stretches[i]!;
    for (const s of edge) {
      const p0 = s.lo === 0 ? a : { x: a.x + ux * s.lo, y: a.y + uy * s.lo };
      const p1 = s.hi === edge[edge.length - 1]!.hi ? b : { x: a.x + ux * s.hi, y: a.y + uy * s.hi };
      items.push({ ex, ey, ux, uy, nx: -uy * sigma, ny: ux * sigma, p0, p1, d: s.d });
    }
  }
  const out: Point[] = [];
  for (let k = 0; k < items.length; k++) {
    const cur = items[k]!;
    const nxt = items[(k + 1) % items.length]!;
    const p = { x: cur.p1.x + cur.nx * cur.d, y: cur.p1.y + cur.ny * cur.d };
    const q = { x: nxt.p0.x + nxt.nx * nxt.d, y: nxt.p0.y + nxt.ny * nxt.d };
    const cross = cur.ex * nxt.ey - cur.ey * nxt.ex;
    const scale = Math.hypot(cur.ex, cur.ey) * Math.hypot(nxt.ex, nxt.ey);
    if (Math.abs(cross) <= 1e-12 * scale) {
      // Parallel: the same edge, or a straight-through vertex. Equal depths continue the line.
      if (cur.d === nxt.d && cur.ex * nxt.ex + cur.ey * nxt.ey > 0) continue;
      out.push(p, q);
      continue;
    }
    const den = cur.ux * nxt.uy - cur.uy * nxt.ux;
    const t = ((q.x - p.x) * nxt.uy - (q.y - p.y) * nxt.ux) / den;
    out.push({ x: p.x + cur.ux * t, y: p.y + cur.uy * t });
  }
  return out.length < 3 ? 0 : (sigma * polygonSignedArea2(out)) / 2;
}

/**
 * A circular room's net area: over each angular interval, the circle inset by half the
 * thickness of the thickest concentric arc wall there. `π(r − d)²` in closed form when one
 * thickness walls the whole circle; `πr²` (the gross area) when none does.
 */
function circleNetArea(c: Point, r: number, segs: readonly WallSegment[]): number {
  const ref = fullCircleArc(c, r);
  const full = ref.sweep;
  const spans: EdgeStretch[] = [];
  for (const s of segs) {
    const arc = s.arc;
    if (!arc) continue;
    if (Math.hypot(arc.center.x - c.x, arc.center.y - c.y) > ON_CENTRELINE_TOL_MM) continue;
    if (Math.abs(arc.r - r) > ON_CENTRELINE_TOL_MM) continue;
    // Walk the arc clockwise from east, as `largestPerimeterGapCircle` does.
    const cw = arc.sweep >= 0;
    const lo = arcAngleOffset(ref, cw ? arc.a : arc.b);
    const hi = arcAngleOffset(ref, cw ? arc.b : arc.a);
    const d = s.thickness / 2;
    if (hi > lo) spans.push({ lo, hi, d });
    else if (hi < lo) {
      spans.push({ lo, hi: full, d });
      if (hi > 0) spans.push({ lo: 0, hi, d });
    }
  }
  if (spans.length === 0) return Math.PI * r * r;
  const cuts = snapCuts(
    spans.flatMap((s) => [s.lo, s.hi]),
    full,
    ON_CENTRELINE_TOL_MM / r,
  );
  let area = 0;
  let uniform: number | null = null;
  let mixed = false;
  for (let i = 0; i + 1 < cuts.length; i++) {
    const lo = cuts[i]!;
    const hi = cuts[i + 1]!;
    const mid = (lo + hi) / 2;
    let d = 0;
    for (const s of spans) if (s.lo < mid && mid < s.hi && s.d > d) d = s.d;
    if (uniform === null) uniform = d;
    else if (uniform !== d) mixed = true;
    const k = Math.max(0, r - d);
    area += 0.5 * (hi - lo) * k * k;
  }
  if (!mixed && uniform !== null) {
    const k = Math.max(0, r - uniform);
    return Math.PI * k * k;
  }
  return area;
}
