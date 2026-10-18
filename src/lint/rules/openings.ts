/**
 * Opening rules: an opening and the walls around it (plan-soundness PS2.1–PS2.3).
 *
 *  - `W_OPENING_AT_JUNCTION` — another wall's body inside an opening's span, or a jamb's nib
 *    to a meeting wall's face shorter than `max(minJunctionNibMm, host thickness × 0.5)`.
 *  - `W_OPENING_OVERLAP` — two openings on one run whose spans intersect, or whose pier is
 *    thinner than a mullion (`minMullionMm`).
 *  - `W_CONNECTOR_AMBIGUOUS` — a door or cased opening whose access edge is `ambiguous`, or
 *    whose clear span covers more than one room on a face of its host (`straddles`).
 *
 * Every position is read off the wall SHAPES: the along-run coordinate of a jamb is the
 * projection onto the host segment (an arc length on a curve, the same `arcOpeningVoid`
 * `W_DOOR_NEAR_CORNER` measures with), and a meeting wall's footprint on the host is where its
 * two face lines cross the host's face line. No bounding box, no centroid, no id or label read
 * for meaning; ids reach only the hints.
 *
 * Every move a hint quotes is searched for and then checked: the moved span stays on its run,
 * keeps the nib to every meeting wall, keeps a mullion to every other opening on the run and,
 * for a door, keeps `W_DOOR_NEAR_CORNER`'s nib at a corner. With grid snapping, the snapped
 * position is the one checked. A direction with no such position is said to have none.
 * No fix is machine-applicable: every remedy moves something the author placed, and there
 * are always at least two (either direction, or the other wall).
 */

import { connectorConnection, connectorFaces, EXTERIOR_NODE } from "../../analyze.js";
import type { Point } from "../../ast.js";
import type { Diagnostic } from "../../diagnostics.js";
import { doorSwing, isDoubleDoorPair, segmentLength, segmentPointAlong, type WallSegment } from "../../geometry.js";
import { arcOpeningVoid } from "../../geometry/arc-band.js";
import { arcTangentAt } from "../../geometry/arc.js";
import type { RDoor, ROpening, RWindow } from "../../ir.js";
import type { LintContext, LintRule } from "../context.js";
import { mm } from "../measure.js";
import { isCorner } from "./doors.js";

type Hosted = RDoor | RWindow | ROpening;

/** Below this turn two runs are parallel (the same 5 degrees `W_DOOR_NEAR_CORNER` uses). */
const PARALLEL_SIN = Math.sin((5 * Math.PI) / 180);
/** Float dust on whole-millimetre geometry. */
const EPS = 1e-6;
/** How far past a face a meeting wall's centreline may stop and still count as meeting it. */
const MEET_TOL_MM = 1;

/** One opening placed on its host run: its along-run span on `seg`, from the shape. */
interface OnRun {
  el: Hosted;
  /** Source order among doors, windows and cased openings (the `ir.elements` index). */
  order: number;
  seg: WallSegment;
  /** Along-run jamb coordinates on `seg` (mm from `seg.a`; arc length on a curve). */
  lo: number;
  hi: number;
}

/** A meeting wall's footprint on a host run, in the host's along-run coordinates. */
interface Junction {
  lo: number;
  hi: number;
  wall: WallSegment;
  /** The host end this wall meets when that end is a CORNER (`isCorner`), else null. */
  corner: "a" | "b" | null;
}

const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x;
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const unitOf = (v: Point): Point | null => {
  const l = Math.hypot(v.x, v.y);
  return l > 0 ? { x: v.x / l, y: v.y / l } : null;
};

/**
 * Where an opening sits on its host segment, or null when it is not on it (an `at (x,y)`
 * element off its wall is `W_*_OFF_WALL`'s report). The on-host tolerance is the access
 * graph's own (`connectorConnection`).
 */
function onRun(el: Hosted, order: number): OnRun | null {
  const seg = el.host;
  if (!seg) return null;
  if (seg.arc) {
    const span = arcOpeningVoid(seg.arc, el.at, el.width, seg.thickness);
    return span ? { el, order, seg, lo: span[0], hi: span[1] } : null;
  }
  const u = unitOf(sub(seg.b, seg.a));
  if (!u) return null;
  const rel = sub(el.at, seg.a);
  if (Math.abs(cross(u, rel)) > seg.thickness / 2 + Math.max(seg.thickness, 1)) return null;
  const s = dot(rel, u);
  return { el, order, seg, lo: s - el.width / 2, hi: s + el.width / 2 };
}

/** Every door, window and cased opening that sits on its host, in source order. */
function openingsOnRuns(ctx: LintContext): OnRun[] {
  const out: OnRun[] = [];
  ctx.ir.elements.forEach((e, i) => {
    if (e.kind !== "door" && e.kind !== "window" && e.kind !== "opening") return;
    const r = onRun(e, i);
    if (r) out.push(r);
  });
  return out;
}

const sameSeg = (p: WallSegment, q: WallSegment): boolean => p.wallId === q.wallId && p.index === q.index;

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

/** The host end a meeting wall touches, when that end is a corner of the host's run. */
function cornerEnd(host: WallSegment, s: WallSegment, all: readonly WallSegment[]): "a" | "b" | null {
  const tol = Math.max(1, host.thickness / 2);
  for (const end of ["a", "b"] as const) {
    const p = host[end];
    const touches = [s.a, s.b].some((q) => Math.hypot(q.x - p.x, q.y - p.y) <= tol);
    if (touches && isCorner(host, end, all)) return end;
  }
  return null;
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
function junctionsOn(host: WallSegment, all: readonly WallSegment[]): Junction[] {
  const out: Junction[] = [];
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
          out.push({ lo: at - half, hi: at + half, wall: s, corner: cornerEnd(host, s, all) });
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
    out.push({ lo, hi, wall: s, corner: cornerEnd(host, s, all) });
  }
  return out;
}

/** {@link junctionsOn} memoised per host segment for one rule run. */
function junctionLookup(ctx: LintContext): (seg: WallSegment) => Junction[] {
  const cache = new Map<string, Junction[]>();
  return (seg) => {
    const k = `${seg.wallId}#${seg.index}`;
    const hit = cache.get(k);
    if (hit) return hit;
    const v = junctionsOn(seg, ctx.wallSegs);
    cache.set(k, v);
    return v;
  };
}

/** The junctions an opening of this kind is measured against: a door's corners are
 *  `W_DOOR_NEAR_CORNER`'s, so a door is not reported twice for one corner. */
const junctionsFor = (o: OnRun, js: readonly Junction[]): Junction[] =>
  o.el.kind === "door" ? js.filter((j) => j.corner === null) : [...js];

/** The nib an opening of this host needs: `max(minJunctionNibMm, host thickness × ratio)`. */
const nibNeed = (ctx: LintContext, seg: WallSegment): number =>
  Math.max(ctx.rules.minJunctionNibMm, seg.thickness * ctx.rules.junctionNibThicknessRatio);

// ─── naming ────────────────────────────────────────────────────────────────────────────

/** ` at x 4000` / ` at y 3000` for a straight axis-aligned segment, else nothing. */
function axisLine(s: WallSegment): string {
  if (s.arc) return " (curved)";
  if (s.a.x === s.b.x && s.a.y !== s.b.y) return ` at x ${mm(s.a.x)}`;
  if (s.a.y === s.b.y && s.a.x !== s.b.x) return ` at y ${mm(s.a.y)}`;
  return ` from (${mm(s.a.x)}, ${mm(s.a.y)}) to (${mm(s.b.x)}, ${mm(s.b.y)})`;
}

/** A wall named by its kind and the line it runs on, never its id. */
const wallPhrase = (s: WallSegment): string => `the ${s.category} wall${axisLine(s)}`;

/** A point on the host run, as the coordinate a reader looks up: `x 3050` on a horizontal
 *  run, `y 3650` on a vertical one, `(x, y)` otherwise. */
function runCoord(seg: WallSegment, s: number): string {
  const p = segmentPointAlong(seg, s);
  if (!seg.arc && seg.a.y === seg.b.y) return `x ${mm(p.x)}`;
  if (!seg.arc && seg.a.x === seg.b.x) return `y ${mm(p.y)}`;
  return `(${mm(p.x)}, ${mm(p.y)})`;
}

/** A span on the host run: `x 3100–4000`, or `(x, y)–(x, y)` off the axes. */
function runSpan(seg: WallSegment, lo: number, hi: number): string {
  const a = runCoord(seg, lo);
  const b = runCoord(seg, hi);
  if (a.startsWith("(")) return `${a}–${b}`;
  const axis = a.slice(0, 2);
  const [p, q] = [a.slice(2), b.slice(2)].map(Number).sort((m, k) => m - k);
  return `${axis}${mm(p!)}–${mm(q!)}`;
}

const KIND_WORD: Record<Hosted["kind"], string> = { door: "door", window: "window", opening: "opening" };

/** An opening named by the rooms it serves (labels, never ids). */
function openingName(ctx: LintContext, el: Hosted): string {
  const { between } = connectorConnection(el, ctx.roomRects, ctx.rules.tolMm);
  const label = (id: string): string | null => {
    const r = ctx.rooms.find((x) => x.id === id);
    return r ? `"${ctx.labelOf(r)}"` : null;
  };
  const word = KIND_WORD[el.kind];
  const [a, b] = [between[0] ?? "", between[1] ?? ""];
  const ext = a === EXTERIOR_NODE ? b : b === EXTERIOR_NODE ? a : null;
  if (ext !== null) {
    const r = label(ext);
    if (r) return el.kind === "window" ? `the window of ${r}` : `the exterior ${word} into ${r}`;
  } else {
    const ra = label(a);
    const rb = label(b);
    if (ra && rb) return `the ${word} between ${ra} and ${rb}`;
    if (ra || rb) return `the ${word} of ${ra ?? rb}`;
  }
  return el.host ? `the ${word} on ${wallPhrase(el.host)}` : `the ${word}`;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** `half of` / `all of` / `0.75 ×` — the thickness limb's ratio, as prose. */
const ratioWords = (r: number): string => (r === 0.5 ? "half" : r === 1 ? "all of" : `${r} ×`);

/** One sentence per distinct fact, in order (two walls on one line read the same). */
const distinct = (xs: readonly string[]): string[] => xs.filter((x, i) => xs.indexOf(x) === i);

// ─── the move search ───────────────────────────────────────────────────────────────────

/** An along-run interval the moved span must not enter (open intervals). */
type Keepout = { lo: number; hi: number };

/**
 * Every along-run keep-out for moving `o` along its run: the run's ends, each meeting wall
 * grown by the nib (`max(minJunctionNibMm, thickness)`), each other opening on the run grown
 * by a mullion, and for a door the corner nib `W_DOOR_NEAR_CORNER` asks for.
 */
function keepouts(ctx: LintContext, o: OnRun, all: readonly OnRun[], js: readonly Junction[]): Keepout[] {
  const len = segmentLength(o.seg);
  const need = nibNeed(ctx, o.seg);
  const out: Keepout[] = [
    { lo: -Infinity, hi: 0 },
    { lo: len, hi: Infinity },
  ];
  for (const j of junctionsFor(o, js)) out.push({ lo: j.lo - need, hi: j.hi + need });
  for (const p of all) {
    if (p === o || !sameRun(o, p)) continue;
    const q = alongOf(o, p);
    out.push({ lo: q.lo - ctx.rules.minMullionMm, hi: q.hi + ctx.rules.minMullionMm });
  }
  if (o.el.kind === "door") {
    const corner = o.seg.thickness * ctx.rules.minCornerNibRatio;
    if (isCorner(o.seg, "a", ctx.wallSegs)) out.push({ lo: -Infinity, hi: corner });
    if (isCorner(o.seg, "b", ctx.wallSegs)) out.push({ lo: len - corner, hi: Infinity });
  }
  return out;
}

const hits = (k: Keepout, lo: number, hi: number): boolean => k.lo < hi - EPS && k.hi > lo + EPS;

/** The along-run centre `o` lands at when moved by `shift`, after the resolver's grid snap. */
function snappedCentre(ctx: LintContext, o: OnRun, shift: number): { s: number; at: Point } {
  const c = (o.lo + o.hi) / 2 + shift;
  const g = ctx.ir.grid;
  const p = segmentPointAlong(o.seg, c);
  if (!(g > 0)) return { s: c, at: p };
  const at = { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g };
  if (o.seg.arc) {
    const span = arcOpeningVoid(o.seg.arc, at, 0, o.seg.thickness);
    return { s: span ? span[0] : Number.NaN, at };
  }
  const u = unitOf(sub(o.seg.b, o.seg.a))!;
  // Off the run after snapping (an angled wall): no checked position here.
  if (Math.abs(cross(u, sub(at, o.seg.a))) > MEET_TOL_MM) return { s: Number.NaN, at };
  return { s: dot(sub(at, o.seg.a), u), at };
}

/**
 * The smallest move of `o` in direction `dir` (towards `seg.b` for +1) that clears every
 * keep-out, or null. Walks the keep-outs it collides with, at most once each, then checks the
 * grid-snapped position; a count, never a time.
 */
function clearMove(
  ctx: LintContext,
  o: OnRun,
  ks: readonly Keepout[],
  dir: 1 | -1,
): { shift: number; at: Point; lo: number; hi: number } | null {
  const w = o.hi - o.lo;
  const g = ctx.ir.grid > 0 ? ctx.ir.grid : 1;
  let shift = 0;
  for (let step = 0; step <= 2 * ks.length + 4; step++) {
    const lo = o.lo + shift;
    const hi = o.hi + shift;
    const blocking = ks.filter((k) => hits(k, lo, hi));
    if (blocking.length === 0) {
      if (shift === 0) return null; // nothing to clear
      const q = Math.ceil(Math.abs(shift) / g - EPS) * g * dir;
      const { s, at } = snappedCentre(ctx, o, q);
      if (Number.isNaN(s)) return null;
      const nlo = s - w / 2;
      const nhi = s + w / 2;
      if (ks.some((k) => hits(k, nlo, nhi))) {
        shift = q + dir * g;
        continue;
      }
      return { shift: Math.abs(s - (o.lo + o.hi) / 2), at, lo: nlo, hi: nhi };
    }
    const edge =
      dir > 0 ? Math.max(...blocking.map((k) => k.hi)) - o.lo : Math.min(...blocking.map((k) => k.lo)) - o.hi;
    if (!Number.isFinite(edge)) return null; // ran off the end of the run
    shift = edge;
  }
  return null;
}

/** The nearest meeting-wall face to a span, in mm (for "that leaves N mm"). */
function nearestNib(lo: number, hi: number, js: readonly Junction[]): number | null {
  let best: number | null = null;
  for (const j of js) {
    const nib = j.hi <= lo ? lo - j.hi : j.lo >= hi ? j.lo - hi : 0;
    if (best === null || nib < best) best = nib;
  }
  return best;
}

/** The cumulative run position of an along-run coordinate on `seg`, for `on <wall> at`. */
function wallPosition(ctx: LintContext, seg: WallSegment, s: number): number {
  let acc = 0;
  for (const t of ctx.wallSegs) {
    if (t.wallId !== seg.wallId) continue;
    if (t.index === seg.index) break;
    acc += segmentLength(t);
  }
  return acc + s;
}

/** The source clause that puts `el` at `at` — in the form it was written in. */
function placeClause(ctx: LintContext, o: OnRun, at: Point, s: number): string {
  return o.el._placement === "attached"
    ? `on ${o.seg.wallId} at ${mm(wallPosition(ctx, o.seg, s))}`
    : `at (${mm(at.x)}, ${mm(at.y)})`;
}

/** The direction word for a move along `seg`: towards the run's end it heads for. */
const towards = (seg: WallSegment, dir: 1 | -1): string => {
  const p = dir > 0 ? seg.b : seg.a;
  return `towards (${mm(p.x)}, ${mm(p.y)})`;
};

/**
 * Does `el`, moved to `at`, still serve exactly the rooms it serves now, with each side of it
 * in one room? The adjacency precondition every quoted move is held to: a move that clears
 * the junction by carrying a door into a different room is a different plan, not a fix.
 */
function servesSame(ctx: LintContext, el: Hosted): (at: Point) => boolean {
  const key = (b: readonly string[]): string => [...b].sort().join("|");
  const before = key(connectorConnection(el, ctx.roomRects, ctx.rules.tolMm).between);
  return (at) => {
    const r = connectorConnection({ ...el, at }, ctx.roomRects, ctx.rules.tolMm);
    return !r.ambiguous && r.straddles === undefined && key(r.between) === before;
  };
}

/** The longest stretch of the run free of every keep-out, among those the span overlaps. */
function widestStretch(o: OnRun, ks: readonly Keepout[]): number {
  const cuts = ks.map((k) => ({ lo: k.lo, hi: k.hi })).sort((a, b) => a.lo - b.lo || a.hi - b.hi);
  let best = 0;
  let from = -Infinity;
  for (const k of [...cuts, { lo: Infinity, hi: Infinity }]) {
    if (k.lo > from && Number.isFinite(from)) {
      const overlaps = Math.min(k.lo, o.hi) > Math.max(from, o.lo);
      if (overlaps) best = Math.max(best, k.lo - from);
    }
    from = Math.max(from, k.hi);
  }
  return best;
}

/**
 * The checked moves for `o`, as hints: one per direction that has a clearing position, each
 * with the span it lands on, the nib it leaves and the source clause; or, when neither
 * direction has one, the measured stretch of wall that is free and how wide an opening it
 * holds. `check` is the adjacency precondition ({@link servesSame} by default).
 */
function moveHints(
  ctx: LintContext,
  o: OnRun,
  all: readonly OnRun[],
  js: readonly Junction[],
  what: string,
  check: (at: Point) => boolean = servesSame(ctx, o.el),
): string[] {
  const ks = keepouts(ctx, o, all, js);
  const out: string[] = [];
  const mine = junctionsFor(o, js);
  for (const dir of [-1, 1] as const) {
    const m = clearMove(ctx, o, ks, dir);
    if (!m || !check(m.at)) continue;
    const nib = nearestNib(m.lo, m.hi, mine);
    const leaves = nib === null ? "" : `, ${mm(nib)} mm from the nearest meeting wall's face`;
    const edit = o.el._instance === undefined ? ` — \`${placeClause(ctx, o, m.at, (m.lo + m.hi) / 2)}\`` : "";
    out.push(
      `Move ${what} ${mm(m.shift)} mm along the wall ${towards(o.seg, dir)}, to ${runSpan(o.seg, m.lo, m.hi)}${leaves}; that position was checked clear of every junction and opening on the run, and it still serves the same rooms${edit}.`,
    );
  }
  if (out.length === 0) {
    const free = widestStretch(o, ks);
    out.push(
      `No position along this run clears it and still serves the same rooms. ${
        free > 0
          ? `The longest clear stretch of wall it overlaps, after the nibs and mullions, is ${mm(free)} mm, against its ${mm(o.hi - o.lo)} mm span.`
          : "No stretch of wall it overlaps is clear once the nibs and mullions are kept."
      } Move it to another wall the same rooms share, or move the wall that meets it.`,
    );
  }
  if (o.el._instance !== undefined)
    out.push("It is drawn by a placed component, so make the move in the component's own frame.");
  return out;
}

/** The id an agent edits by, for the hints. */
const idHint = (el: Hosted): string => `The ${KIND_WORD[el.kind]} is "${el.id}" on wall "${el.host?.wallId ?? ""}".`;

// ─── PS2.1 ─────────────────────────────────────────────────────────────────────────────

/**
 * `W_OPENING_AT_JUNCTION`: an opening — door, window or cased opening — runs into a wall that
 * meets its host, or leaves too short a nib of wall between a jamb and that wall's face.
 *
 * "Meets" covers a tee (a wall ending on the host), a crossing, a host that itself ends on
 * another wall, and a corner. The nib is measured along the run from the jamb to the meeting
 * wall's FACE, and must be at least `max(minJunctionNibMm, host thickness ×
 * junctionNibThicknessRatio)`, 100 mm and half the thickness by default
 * ({@link import("../ruleset.js").LintRuleset.minJunctionNibMm} and
 * {@link import("../ruleset.js").LintRuleset.junctionNibThicknessRatio} have the sources).
 *
 * **Relation to `W_DOOR_NEAR_CORNER`.** That rule already measures a DOOR at a corner (to
 * the corner point, against the wall's thickness). One defect gets one warning, so a door is
 * never measured here against a wall forming a corner with its host; it is measured against
 * tees and crossings only. Windows and cased openings, which that rule does not cover, are
 * measured at corners too. Every plan's existing `W_DOOR_NEAR_CORNER` output is unchanged.
 */
export const openingAtJunction: LintRule = {
  name: "opening-at-junction",
  check(ctx: LintContext): Diagnostic[] {
    const out: Diagnostic[] = [];
    const all = openingsOnRuns(ctx);
    const jsOf = junctionLookup(ctx);
    for (const o of all) {
      const js = jsOf(o.seg);
      const mine = junctionsFor(o, js);
      if (mine.length === 0) continue;
      const need = nibNeed(ctx, o.seg);
      const inside = mine.filter((j) => j.lo < o.hi - EPS && j.hi > o.lo + EPS);
      let left: { j: Junction; nib: number } | null = null;
      let right: { j: Junction; nib: number } | null = null;
      for (const j of mine) {
        if (inside.includes(j)) continue;
        if (j.hi <= o.lo + EPS) {
          const nib = Math.max(0, o.lo - j.hi);
          if (nib < need - EPS && (!left || nib < left.nib)) left = { j, nib };
        } else {
          const nib = Math.max(0, j.lo - o.hi);
          if (nib < need - EPS && (!right || nib < right.nib)) right = { j, nib };
        }
      }
      if (inside.length === 0 && !left && !right) continue;

      const name = openingName(ctx, o.el);
      const span = runSpan(o.seg, o.lo, o.hi);
      const facts: string[] = [];
      for (const j of inside) {
        const lo = Math.max(j.lo, o.lo);
        const hi = Math.min(j.hi, o.hi);
        facts.push(
          `${wallPhrase(j.wall)} stands inside its span (${span}; that wall occupies ${runSpan(o.seg, j.lo, j.hi)}, ${mm(hi - lo)} mm of the opening)`,
        );
      }
      for (const [side, at] of [
        [left, o.lo],
        [right, o.hi],
      ] as const) {
        if (!side) continue;
        const face = side.j.hi <= o.lo + EPS ? side.j.hi : side.j.lo;
        facts.push(
          `its jamb at ${runCoord(o.seg, at)} is ${mm(side.nib)} mm from the face of ${wallPhrase(side.j.wall)} (at ${runCoord(o.seg, face)})`,
        );
      }
      const reason =
        inside.length > 0
          ? "A wall standing inside an opening is a pier in it, and the opening's frame has no jamb to close on."
          : `A jamb needs at least ${mm(need)} mm of wall beside it (the larger of ${mm(ctx.rules.minJunctionNibMm)} mm and ${ratioWords(ctx.rules.junctionNibThicknessRatio)} this wall's ${mm(o.seg.thickness)} mm thickness) to carry its frame or lining.`;
      const accept =
        inside.length > 0
          ? o.el.kind === "window"
            ? "Accept it if the glazing is meant to run past the junction, with the meeting wall stopping on a mullion."
            : o.el.kind === "opening"
              ? "Accept it if the meeting wall is a screen that stops short of the opening's head."
              : null
          : "Accept it if the frame is meant to be fixed into the meeting wall itself (a flush corner detail).";
      out.push({
        severity: "warning",
        code: "W_OPENING_AT_JUNCTION",
        ...ctx.at(o.el),
        message: `${cap(name)} meets a wall junction — ${distinct(facts).join("; ")}. ${reason}`,
        hints: [
          ...moveHints(ctx, o, all, js, `the ${KIND_WORD[o.el.kind]}`),
          ...(accept ? [accept] : []),
          idHint(o.el),
        ],
      });
    }
    return out;
  },
};

// ─── PS2.2 ─────────────────────────────────────────────────────────────────────────────

/** Do two openings sit on one run: one segment, or collinear straight segments of one wall? */
function sameRun(p: OnRun, q: OnRun): boolean {
  if (sameSeg(p.seg, q.seg)) return true;
  if (p.seg.wallId !== q.seg.wallId || p.seg.arc || q.seg.arc) return false;
  const u = unitOf(sub(p.seg.b, p.seg.a));
  const v = unitOf(sub(q.seg.b, q.seg.a));
  if (!u || !v || Math.abs(cross(u, v)) >= PARALLEL_SIN) return false;
  return Math.abs(cross(u, sub(q.seg.a, p.seg.a))) <= MEET_TOL_MM;
}

/** `q`'s span in `p`'s along-run coordinates (the two are on one run). */
function alongOf(p: OnRun, q: OnRun): { lo: number; hi: number } {
  if (sameSeg(p.seg, q.seg)) return { lo: q.lo, hi: q.hi };
  const u = unitOf(sub(p.seg.b, p.seg.a))!;
  const c = dot(sub(q.el.at, p.seg.a), u);
  return { lo: c - q.el.width / 2, hi: c + q.el.width / 2 };
}

/** Are two openings the two leaves of one double door? */
function doubleDoor(p: Hosted, q: Hosted): boolean {
  if (p.kind !== "door" || q.kind !== "door") return false;
  const a = doorSwing(p);
  const b = doorSwing(q);
  return a !== null && b !== null && isDoubleDoorPair(a, b);
}

/**
 * `W_OPENING_OVERLAP`: two openings on one run whose along-run spans intersect, or leave a
 * pier thinner than a mullion (`minMullionMm`) between them. One warning per pair, on the
 * later-declared opening, naming both by the rooms they serve.
 */
export const openingOverlap: LintRule = {
  name: "opening-overlap",
  check(ctx: LintContext): Diagnostic[] {
    const out: Diagnostic[] = [];
    const all = openingsOnRuns(ctx);
    const jsOf = junctionLookup(ctx);
    const min = ctx.rules.minMullionMm;
    for (let j = 0; j < all.length; j++) {
      const later = all[j]!;
      for (let i = 0; i < j; i++) {
        const earlier = all[i]!;
        if (!sameRun(later, earlier)) continue;
        const e = alongOf(later, earlier);
        const overlap = Math.min(later.hi, e.hi) - Math.max(later.lo, e.lo);
        if (overlap <= EPS && -overlap >= min - EPS) continue;
        // Two hinged leaves closing onto one shared latch jamb are ONE double door, which is how
        // the language draws a pair (`isDoubleDoorPair`, the rule `W_SWING_OBSTRUCTED` exempts).
        if (overlap <= EPS && doubleDoor(later.el, earlier.el)) continue;
        const nameL = openingName(ctx, later.el);
        const nameE = openingName(ctx, earlier.el);
        const kL = KIND_WORD[later.el.kind];
        const kE = KIND_WORD[earlier.el.kind];
        const spans = `this ${kL} spans ${runSpan(later.seg, later.lo, later.hi)} and the ${kE} ${runSpan(later.seg, e.lo, e.hi)}`;
        const fact =
          overlap > EPS
            ? `${spans}, so ${mm(overlap)} mm of wall is claimed by both`
            : `${spans}, leaving a ${mm(-overlap)} mm pier between them, under the ${mm(min)} mm of a mullion`;
        const reason =
          overlap > EPS
            ? "Two openings cannot share a length of wall: one cuts through the other's frame."
            : "A pier thinner than a mullion has no room for the two frames that meet on it.";
        const hints = [
          ...moveHints(ctx, later, all, jsOf(later.seg), `this ${kL}`),
          ...moveHints(ctx, earlier, all, jsOf(earlier.seg), `the ${kE}`)
            .filter((h) => h.startsWith("Move"))
            .map((h) => `Or m${h.slice(1)}`),
          ...(overlap > EPS
            ? []
            : [
                "Accept it if the two are one framed unit (a door with a sidelight, or windows meeting on a mullion thinner than 100 mm).",
              ]),
          `This ${kL} is "${later.el.id}"; the ${kE} is "${earlier.el.id}"; both are on wall "${later.seg.wallId}".`,
        ];
        out.push({
          severity: "warning",
          code: "W_OPENING_OVERLAP",
          ...ctx.at(later.el),
          message: `${cap(nameL)} ${overlap > EPS ? "overlaps" : "almost meets"} ${nameE} on ${wallPhrase(later.seg)} — ${fact}. ${reason}`,
          hints,
        });
      }
    }
    return out;
  },
};

// ─── PS2.3 ─────────────────────────────────────────────────────────────────────────────

/**
 * `W_CONNECTOR_AMBIGUOUS`: a door or cased opening whose access edge cannot name the two
 * spaces it joins — the edge is `ambiguous` (three or more rooms at its point, and the face
 * probe cannot decide), or a face of its host has more than one room along the connector's
 * clear span (`straddles`). The message names the rooms on each side by label; ids are in the
 * hints.
 */
export const connectorAmbiguous: LintRule = {
  name: "connector-ambiguous",
  check(ctx: LintContext): Diagnostic[] {
    const out: Diagnostic[] = [];
    const edges = ctx.access().edges;
    const all = openingsOnRuns(ctx);
    const label = (id: string): string => {
      const r = ctx.rooms.find((x) => x.id === id);
      return r ? `"${ctx.labelOf(r)}"` : "outside";
    };
    const list = (ids: readonly string[]): string =>
      ids.length <= 1
        ? ids.map(label).join("")
        : `${ids.slice(0, -1).map(label).join(", ")} and ${label(ids[ids.length - 1]!)}`;
    ctx.connectors.forEach((c, k) => {
      const e = edges[k];
      if (!e || e.doorId !== c.id) return;
      if (!e.ambiguous && !e.straddles) return;
      const faces = connectorFaces(c, ctx.roomRects);
      if (!faces || !c.host) return;
      const word = KIND_WORD[c.kind];
      const exteriorHost = c.host.category === "exterior";
      // Which face is the outside one, when one face holds no room behind an exterior wall.
      const isOuter = (i: 0 | 1): boolean => exteriorHost && faces[i].cover.length === 0;
      const sideName = (i: 0 | 1): string =>
        isOuter(i)
          ? "its outer side"
          : isOuter(i === 0 ? 1 : 0)
            ? "its inner side"
            : i === 0
              ? "one side"
              : "the other side";
      const sides: string[] = [];
      for (const i of [0, 1] as const) {
        const f = faces[i];
        const nm = sideName(i);
        if (f.cover.length > 1) {
          sides.push(`${nm} spans ${f.cover.map((x) => `${label(x.id)} (${mm(x.mm)} mm)`).join(" and ")}`);
        } else if (f.holders.length > 1) {
          sides.push(`${nm} is centred on the boundary between ${list(f.holders)}`);
        } else if (f.cover.length === 1) {
          sides.push(`${nm} opens into ${label(f.cover[0]!.id)}`);
        } else if (f.holders.length === 1) {
          sides.push(`${nm} opens into ${label(f.holders[0]!)}`);
        } else {
          sides.push(isOuter(i) ? `${nm} is outside` : `${nm} opens onto no room`);
        }
      }
      const reading = e.ambiguous
        ? "so the plan does not say which two spaces it joins and the access graph leaves it out of every route"
        : `so which room it opens into is a guess (the access graph reads it as between ${list(e.between.filter((x) => x !== ""))})`;
      // A move is quoted only when the moved connector reads one room per face and is not ambiguous.
      const o = all.find((x) => x.el === c);
      const near = new Set<string>([
        EXTERIOR_NODE,
        ...faces.flatMap((f) => [...f.holders, ...f.cover.map((x) => x.id)]),
      ]);
      const checkMove = (at: Point): boolean => {
        const r = connectorConnection({ ...c, at }, ctx.roomRects, ctx.rules.tolMm);
        return !r.ambiguous && r.straddles === undefined && r.between.every((x) => near.has(x));
      };
      const moves = o ? moveHints(ctx, o, all, junctionsOn(o.seg, ctx.wallSegs), `the ${word}`, checkMove) : [];
      const wallInside =
        o !== undefined && junctionsFor(o, junctionsOn(o.seg, ctx.wallSegs)).some((j) => j.lo < o.hi && j.hi > o.lo);
      const straddled = e.straddles ?? [];
      const hints = [
        ...moves.filter((h) => h.startsWith("Move")),
        ...(moves.some((h) => h.startsWith("Move"))
          ? []
          : [
              `No checked position along this wall puts each side of the ${word} in one room. Move it to a wall two rooms share, or move the walls that meet it.`,
            ]),
        ...(!e.ambiguous && !wallInside && straddled.length > 1
          ? [
              `Accept it if ${list(straddled)} are one open space with no wall between them, so the ${word} serves both.`,
            ]
          : []),
        `The ${word} is "${c.id}" on wall "${c.host.wallId}"${straddled.length ? `; its span covers rooms ${straddled.map((x) => `"${x}"`).join(", ")}` : ""}.`,
      ];
      out.push({
        severity: "warning",
        code: "W_CONNECTOR_AMBIGUOUS",
        ...ctx.at(c),
        message: `${cap(`the ${word} on ${wallPhrase(c.host)}`)} does not join two rooms cleanly — ${sides.join(", and ")}, ${reading}. A doorway joins exactly two spaces, and each side of it should lie in one of them.`,
        hints,
      });
    });
    return out;
  },
};
