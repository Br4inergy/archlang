/**
 * Where other walls meet a host wall's run: the measure `W_OPENING_AT_JUNCTION` reports with
 * (`src/lint/rules/openings.ts`) and a relational opening is refused by (`E_OPENING_NIB`,
 * ADR 0028 §5), so the warning and the refusal can never measure two different things.
 * Moved here verbatim from the lint rule; pure, no lint context.
 */

import type { Point } from "./ast.js";
import { segmentLength, type WallSegment } from "./geometry.js";
import { arcTangentAt } from "./geometry/arc.js";

/** Below this turn two runs are parallel (the same 5 degrees `W_DOOR_NEAR_CORNER` uses). */
export const PARALLEL_SIN = Math.sin((5 * Math.PI) / 180);
/** How far past a face a meeting wall's centreline may stop and still count as meeting it. */
export const MEET_TOL_MM = 1;
/** A jamb this close to a meeting wall's face is flush with it (whole-millimetre geometry). */
export const FLUSH_MM = 0.5;
/** Float dust on whole-millimetre geometry. */
export const JUNCTION_EPS = 1e-6;

/**
 * The nib a jamb needs to a meeting wall's face: `max(minJunctionNibMm, host thickness ×
 * junctionNibThicknessRatio)`. These are the lint ruleset's DEFAULTS (`DEFAULT_RULESET`
 * reads them from here) and the values a relational opening is refused by (`E_OPENING_NIB`,
 * ADR 0028 §5): `compile()` reads no lint profile, so a profile that changes the lint's
 * numbers does not change the refusal.
 */
export const JUNCTION_NIB_DEFAULTS = Object.freeze({ minJunctionNibMm: 100, junctionNibThicknessRatio: 0.5 });

/** A meeting wall's footprint on a host run, in the host's along-run coordinates. */
export interface JunctionSpan {
  lo: number;
  hi: number;
  wall: WallSegment;
}

const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x;
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const unitOf = (v: Point): Point | null => {
  const l = Math.hypot(v.x, v.y);
  return l > 0 ? { x: v.x / l, y: v.y / l } : null;
};

/** One segment of one wall: the same wall id and segment index. */
export const sameSeg = (p: WallSegment, q: WallSegment): boolean => p.wallId === q.wallId && p.index === q.index;

/** A straight stand-in for a wall segment near one point: the segment itself, or for an arc
 *  the tangent ray from whichever end lies within the host's body. */
function straightOf(s: WallSegment, host: WallSegment, n: Point): Array<{ a: Point; d: Point; len: number }> {
  if (!s.arc) {
    const d = unitOf(sub(s.b, s.a));
    return d ? [{ a: s.a, d, len: Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) }] : [];
  }
  const out: Array<{ a: Point; d: Point; len: number }> = [];
  for (const end of ["a", "b"] as const) {
    const e = s[end];
    const f = dot(sub(e, host.a), n);
    if (Math.abs(f) > host.thickness / 2 + MEET_TOL_MM) continue;
    const t = arcTangentAt(s.arc, e);
    const d = end === "a" ? t : { x: -t.x, y: -t.y };
    out.push({ a: e, d, len: 2 * Math.max(host.thickness, s.thickness) });
  }
  return out;
}

/**
 * Every other wall segment's footprint on `host`'s run: where its body meets the host's face
 * lines, as an along-run interval.
 *
 * Straight host: a wall meets a face when its centreline reaches that face line (a stem
 * ending on the host's centreline reaches the near face only; a crossing wall reaches both;
 * the host's own next run at a corner reaches the inner face). Its footprint on that face runs
 * between the crossings of its two face lines, so an angled wall's footprint is exact at the
 * face. Per wall, the hull over the faces it meets.
 *
 * Curved host: only the two ENDS are measured — a wall meeting the curve's end leaves its
 * centreline at the run's end and its face `t / (2 sin θ)` short of it, at the centreline
 * radius (the datum `W_DOOR_NEAR_CORNER` uses on a curve). A wall meeting a curve part-way
 * along is not measured.
 */
export function junctionSpans(host: WallSegment, all: readonly WallSegment[]): JunctionSpan[] {
  const out: JunctionSpan[] = [];
  const len = segmentLength(host);
  if (host.arc) {
    const tol = Math.max(1, host.thickness / 2);
    for (const end of ["a", "b"] as const) {
      const p = host[end];
      const t = arcTangentAt(host.arc, p);
      for (const s of all) {
        if (sameSeg(s, host)) continue;
        for (const oe of ["a", "b"] as const) {
          if (Math.hypot(s[oe].x - p.x, s[oe].y - p.y) > tol) continue;
          const dir = s.arc ? arcTangentAt(s.arc, s[oe]) : unitOf(oe === "a" ? sub(s.b, s.a) : sub(s.a, s.b));
          if (!dir) continue;
          const sin = Math.abs(cross(t, dir));
          if (sin < PARALLEL_SIN) continue; // the wall carries on along the curve
          const half = s.thickness / (2 * sin);
          const at = end === "a" ? 0 : len;
          out.push({ lo: at - half, hi: at + half, wall: s });
        }
      }
    }
    return out;
  }
  const u = unitOf(sub(host.b, host.a));
  if (!u) return out;
  const n = { x: -u.y, y: u.x };
  const th = host.thickness;
  const f = (p: Point): number => dot(sub(p, host.a), n);
  const along = (p: Point): number => dot(sub(p, host.a), u);
  for (const s of all) {
    if (sameSeg(s, host)) continue;
    let lo = Infinity;
    let hi = -Infinity;
    for (const line of straightOf(s, host, n)) {
      const sin = cross(u, line.d); // = n · d
      if (Math.abs(sin) < PARALLEL_SIN) continue;
      const m = { x: -line.d.y, y: line.d.x };
      for (const c of [-th / 2, th / 2]) {
        const t = (c - f(line.a)) / sin;
        if (t < -MEET_TOL_MM || t > line.len + MEET_TOL_MM) continue; // does not reach this face
        for (const side of [-1, 1]) {
          const q = { x: line.a.x + (m.x * side * s.thickness) / 2, y: line.a.y + (m.y * side * s.thickness) / 2 };
          const tq = (c - f(q)) / sin;
          const x = along({ x: q.x + line.d.x * tq, y: q.y + line.d.y * tq });
          lo = Math.min(lo, x);
          hi = Math.max(hi, x);
        }
      }
    }
    if (!(hi >= lo)) continue;
    // It must touch the host's own body, ends included.
    if (lo > len + th / 2 + MEET_TOL_MM || hi < -th / 2 - MEET_TOL_MM) continue;
    out.push({ lo, hi, wall: s });
  }
  return out;
}
