/**
 * Space-enclosure rules (plan-soundness PS2.4): floor the walls and the rooms disagree about.
 *
 *  - `W_BOUNDARY_NO_WALL` — two rooms meet along an edge with a run longer than a doorway
 *    (`maxBoundaryGapMm`) that no wall, door, cased opening or fixed counter stands on.
 *  - `W_FLOOR_UNASSIGNED` — a closed region of floor the walls enclose (a walled face) that the
 *    rooms cover less than `minFaceCoverRatio` of, by at least `minUnassignedM2`.
 *  - `W_ROOM_OUTSIDE_SHELL` — a room with at least `minOutsideShellM2` of its floor off every
 *    walled face and every wall: outside the building.
 *
 * **From the shapes.** The run two rooms share is read off their own rings: a pair of
 * parallel edges within `tolMm` of each other (the room-adjacency test), checked by probing
 * just past each edge that one room's floor is on each side ({@link pointInRoomBox}). What
 * stands on the run is measured along the line midway between the two edges: the straight
 * wall centrelines within `tolMm` of it (`edgeWallCover`, the measure `W_ROOM_NOT_ENCLOSED`
 * reads a wet room's perimeter with, here generalised to any pair of rooms), the span of every
 * door and cased opening on it, and the extent along it of every fixed counter that stands
 * across it. A curved wall backs no straight run (its chord is not a wall). Walled faces and
 * the outside are the holes and the exterior of the joined wall bands (`src/analyze/wall-faces.ts`),
 * measured in closed form against the rooms' own shapes — arcs and circle rooms included. A
 * bounding box only skips what cannot meet.
 *
 * **Exemptions, and why.** Two rooms whose uses (`roomUses`: their `uses`, else the label
 * vocabulary — never an id) are each one of kitchen, dining or living are an open-plan pair:
 * the missing wall is the design. A walled face with no door or cased opening into it and no
 * room bordering its empty floor is a sealed pocket (a duct, a spandrel behind a curved wall),
 * not floor anyone forgot: it is not reported. Floor under an `outdoor` surface, a `void` or a
 * stair, lift or escalator is assigned, though it is no room. `W_ROOM_OUTSIDE_SHELL` is silent
 * on a storey whose walls close no face at all: with no shell there is no inside to be outside
 * of, and the rule refuses rather than guesses (ADR 0005).
 *
 * Messages name rooms by label and walls by kind; element ids are in the hints only. No rule
 * offers a machine fix: a wall, a room edge or a surface is a design decision.
 */

import type { Point } from "../../ast.js";
import { edgeWallCover, type RoomBox, pointInRoomBox, rectOf, roomRing, roomUses } from "../../analyze.js";
import { type FaceRoom, faceCover, roomOutside, type WallFaces, wallFaces } from "../../analyze/wall-faces.js";
import type { Diagnostic } from "../../diagnostics.js";
import { distPointToWallSegment, wallFaceProbes } from "../../geometry.js";
import { edgeMid, edgeTangentAt } from "../../geometry/band.js";
import { collinearOverlapLength } from "../../geometry/polygon.js";
import type { ResolvedPlan, RRoom, RWall } from "../../ir.js";
import { fmt2 } from "../../num-format.js";
import type { LintContext, LintRule } from "../context.js";
import { mm } from "../measure.js";

/** Uses that make an open-plan pair: two rooms each with one of these need no wall between them. */
const OPEN_PLAN: ReadonlySet<string> = new Set(["kitchen", "dining", "living"]);

/**
 * Fixed pieces that close a boundary they stand across — a servery counter, a bar, a kitchen
 * island (the first-contact café's counter in the gap to its seating,
 * `docs/plans/plan-soundness/audits/2026-10-18-first-contact.md` C-plan). Free furniture
 * (a table, a sofa) does not: it moves.
 */
const BOUNDARY_FIXTURES: ReadonlySet<string> = new Set(["counter", "bar_counter", "island"]);

/**
 * How far past each room's edge the shared-run probe stands (mm): half the thinnest partition
 * the examples draw, the depth `JAMB_PROBE_INSET_MM` uses, so a probe is on the room's floor
 * and not past a room as shallow as a cupboard.
 */
const RUN_PROBE_MM = 50;

/** The thinnest partition a quoted wall statement gets when the rooms meet edge to edge. */
const DEFAULT_PARTITION_MM = 100;

/** Float dust on whole-millimetre geometry. */
const EPS = 1e-6;

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** `"A"`, `"A" and "B"`, `"A", "B" and "C"`. */
function listOf(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** `x 4000` on a vertical line, `y 4000` on a horizontal one, else a point pair. */
function runWords(p: Point, q: Point): string {
  if (Math.abs(p.x - q.x) < EPS)
    return `on the line x ${mm(p.x)}, y ${mm(Math.min(p.y, q.y))}–${mm(Math.max(p.y, q.y))}`;
  if (Math.abs(p.y - q.y) < EPS)
    return `on the line y ${mm(p.y)}, x ${mm(Math.min(p.x, q.x))}–${mm(Math.max(p.x, q.x))}`;
  return `from (${mm(p.x)}, ${mm(p.y)}) to (${mm(q.x)}, ${mm(q.y)})`;
}

// ─── W_BOUNDARY_NO_WALL ────────────────────────────────────────────────────────────────

/** One run two rooms share, measured along the line midway between their edges. */
interface SharedRun {
  /** The run's ends on the midline. */
  p: Point;
  q: Point;
  len: number;
  /** Distance between the two rooms' edges (0 when drawn on one centreline). */
  sep: number;
  /** The longest stretch with nothing standing on it, in mm from `p`. */
  gap: [number, number];
}

/** Complement of `covered` within `[0, len]`: the uncovered stretches, in order. */
function gapsOf(covered: Array<[number, number]>, len: number): Array<[number, number]> {
  const sorted = covered
    .map(([a, b]): [number, number] => [Math.max(0, a), Math.min(len, b)])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [];
  let at = 0;
  for (const [a, b] of sorted) {
    if (a > at) out.push([at, a]);
    at = Math.max(at, b);
  }
  if (len > at) out.push([at, len]);
  return out;
}

/**
 * Every run rooms `a` and `b` share, with what stands on it. Each is a pair of parallel ring
 * edges within `tolMm` that overlap along their length, with `a`'s floor on one side and
 * `b`'s on the other just past the edges at the run's middle (rooms that overlap or nest
 * share no boundary).
 */
function sharedRuns(ctx: LintContext, a: RRoom, b: RRoom): SharedRun[] {
  const ba = ctx.roomRects.get(a.id)!;
  const bb = ctx.roomRects.get(b.id)!;
  const tol = ctx.rules.tolMm;
  const out: SharedRun[] = [];
  const ringA = roomRing(ba);
  const ringB = roomRing(bb);
  const straight = ctx.wallSegs.filter((s) => !s.arc);
  for (let i = 0; i < ringA.length; i++) {
    const a1 = ringA[i]!;
    const a2 = ringA[(i + 1) % ringA.length]!;
    const la = Math.hypot(a2.x - a1.x, a2.y - a1.y);
    if (la < EPS) continue;
    const u = { x: (a2.x - a1.x) / la, y: (a2.y - a1.y) / la };
    const n = { x: -u.y, y: u.x };
    for (let j = 0; j < ringB.length; j++) {
      const b1 = ringB[j]!;
      const b2 = ringB[(j + 1) % ringB.length]!;
      if (collinearOverlapLength(a1, a2, b1, b2, tol) <= EPS) continue;
      const off = (b1.x - a1.x) * n.x + (b1.y - a1.y) * n.y;
      const t1 = (b1.x - a1.x) * u.x + (b1.y - a1.y) * u.y;
      const t2 = (b2.x - a1.x) * u.x + (b2.y - a1.y) * u.y;
      const lo = Math.max(0, Math.min(t1, t2));
      const hi = Math.min(la, Math.max(t1, t2));
      if (hi - lo <= EPS) continue;
      const at = (t: number): Point => ({
        x: a1.x + u.x * t + (n.x * off) / 2,
        y: a1.y + u.y * t + (n.y * off) / 2,
      });
      const mid = at((lo + hi) / 2);
      const d = Math.abs(off) / 2 + RUN_PROBE_MM;
      const plus = { x: mid.x + n.x * d, y: mid.y + n.y * d };
      const minus = { x: mid.x - n.x * d, y: mid.y - n.y * d };
      const inA = (p: Point): boolean => pointInRoomBox(p, ba);
      const inB = (p: Point): boolean => pointInRoomBox(p, bb);
      const opposite =
        (inA(minus) && inB(plus) && !inA(plus) && !inB(minus)) ||
        (inA(plus) && inB(minus) && !inA(minus) && !inB(plus));
      if (!opposite) continue;
      const p = at(lo);
      const q = at(hi);
      const len = hi - lo;
      const covered: Array<[number, number]> = [...edgeWallCover(p, q, straight, tol)];
      const along = (x: Point): number => (x.x - p.x) * u.x + (x.y - p.y) * u.y;
      const across = (x: Point): number => (x.x - p.x) * n.x + (x.y - p.y) * n.y;
      for (const c of ctx.connectors) {
        if (Math.abs(across(c.at)) > tol) continue;
        const s = along(c.at);
        covered.push([s - c.width / 2, s + c.width / 2]);
      }
      for (const f of ctx.furniture) {
        if (!BOUNDARY_FIXTURES.has(f.category)) continue;
        const r = rectOf(f);
        const corners = [
          { x: r.x, y: r.y },
          { x: r.x + r.w, y: r.y },
          { x: r.x + r.w, y: r.y + r.h },
          { x: r.x, y: r.y + r.h },
        ];
        const ns = corners.map(across);
        if (Math.max(...ns) < -d || Math.min(...ns) > d) continue;
        const ss = corners.map(along);
        covered.push([Math.min(...ss), Math.max(...ss)]);
      }
      const gaps = gapsOf(covered, len);
      if (gaps.length === 0) continue;
      const gap = gaps.reduce((w, g) => (g[1] - g[0] > w[1] - w[0] ? g : w));
      out.push({ p, q, len, sep: Math.abs(off), gap });
    }
  }
  return out;
}

/** Could two room boxes share an edge within `tol`? A filter only: the shapes decide. */
const boxesNear = (a: RoomBox, b: RoomBox, tol: number): boolean =>
  a.x <= b.x + b.w + tol && b.x <= a.x + a.w + tol && a.y <= b.y + b.h + tol && b.y <= a.y + a.h + tol;

/**
 * `W_BOUNDARY_NO_WALL`: two rooms share an edge run on which a stretch longer than a doorway
 * (`maxBoundaryGapMm`) has no wall, door, cased opening or fixed counter. One warning per pair,
 * on the later-declared room, measuring the longest such stretch. An open-plan pair (both
 * kitchen, dining or living) is exempt; a circle room shares no straight run.
 */
export const boundaryNoWall: LintRule = {
  name: "boundary-no-wall",
  check(ctx: LintContext): Diagnostic[] {
    const out: Diagnostic[] = [];
    const max = ctx.rules.maxBoundaryGapMm;
    const tol = ctx.rules.tolMm;
    const rooms = ctx.rooms;
    const thinnest = ctx.ir.walls.reduce(
      (t, w) => (w.category === "partition" ? Math.min(t, w.thickness) : t),
      Infinity,
    );
    for (let j = 0; j < rooms.length; j++) {
      const b = rooms[j]!;
      if (b.circle) continue;
      for (let i = 0; i < j; i++) {
        const a = rooms[i]!;
        if (a.circle) continue;
        if (!boxesNear(ctx.roomRects.get(a.id)!, ctx.roomRects.get(b.id)!, tol)) continue;
        const ua = [...roomUses(a)];
        const ub = [...roomUses(b)];
        if (ua.some((x) => OPEN_PLAN.has(x)) && ub.some((x) => OPEN_PLAN.has(x))) continue;
        const runs = sharedRuns(ctx, a, b);
        if (runs.length === 0) continue;
        const worst = runs.reduce((w, r) => (r.gap[1] - r.gap[0] > w.gap[1] - w.gap[0] ? r : w));
        const gapLen = worst.gap[1] - worst.gap[0];
        if (gapLen <= max + EPS) continue;
        const u = {
          x: (worst.q.x - worst.p.x) / worst.len,
          y: (worst.q.y - worst.p.y) / worst.len,
        };
        // The open stretch's two ends, west/north end first, so the quoted wall reads the way
        // a person writes one whatever direction the room's ring runs.
        const ends = [worst.gap[0], worst.gap[1]]
          .map((s) => ({ x: worst.p.x + u.x * s, y: worst.p.y + u.y * s }))
          .sort((m, k) => Math.round(m.x) - Math.round(k.x) || m.y - k.y);
        const g0 = ends[0]!;
        const g1 = ends[1]!;
        const na = `"${ctx.labelOf(a)}"`;
        const nb = `"${ctx.labelOf(b)}"`;
        const all = Math.abs(gapLen - worst.len) <= EPS;
        const fact = all
          ? `they meet along ${mm(worst.len)} mm ${runWords(worst.p, worst.q)} with no wall, door or opening anywhere on it`
          : `they meet along ${mm(worst.len)} mm ${runWords(worst.p, worst.q)}, and ${mm(gapLen)} mm of it (${runWords(g0, g1).replace(/^on the line /, "")}) has no wall, door or opening`;
        const thick = worst.sep > EPS ? worst.sep : Number.isFinite(thinnest) ? thinnest : DEFAULT_PARTITION_MM;
        const stmt = `wall partition thickness ${mm(thick)} { (${mm(g0.x)},${mm(g0.y)}) (${mm(g1.x)},${mm(g1.y)}) }`;
        out.push({
          severity: "warning",
          code: "W_BOUNDARY_NO_WALL",
          ...ctx.at(b),
          message: `${cap(na)} and ${nb} have no wall between them: ${fact}, wider than a ${mm(max)} mm doorway. Without a wall they are one space that anyone walks through, but no door or opening joins them in the plan, so routes, privacy and enclosure are read as if the wall were there.`,
          hints: [
            `Draw the missing partition, e.g. \`${stmt}\`, and put a \`door\` in it if the two rooms should connect.`,
            `If they are one space by design, draw that wall with a cased \`opening\` across the gap, so the plan says how they join.`,
            `Accept it if the boundary is closed by something the plan does not draw (a fixed screen, a balustrade, a level change).`,
            `The rooms are "${a.id}" and "${b.id}".`,
          ],
        });
      }
    }
    return out;
  },
};

// ─── walled faces (W_FLOOR_UNASSIGNED, W_ROOM_OUTSIDE_SHELL) ──────────────────────────

/** The faces of a storey, computed once per resolved plan and shared by both rules. */
const FACES = new WeakMap<ResolvedPlan, WallFaces | null>();
const facesOf = (ir: ResolvedPlan): WallFaces | null => {
  if (!FACES.has(ir)) FACES.set(ir, wallFaces(ir.walls));
  return FACES.get(ir) ?? null;
};

/** Does a door or cased opening open into face `fi` (one host thickness off either face)? */
function faceHasWayIn(ctx: LintContext, wf: WallFaces, fi: number): boolean {
  return ctx.connectors.some((c) => {
    if (!c.host) return false;
    const probes = wallFaceProbes(c.host, c.at, Math.max(c.host.thickness, 1));
    return wf.faceAt(probes.plus) === fi || wf.faceAt(probes.minus) === fi;
  });
}

/** The walls along a face's boundary (a wall face within 1 mm of an edge's middle), in wall order. */
function wallsRound(ctx: LintContext, wf: WallFaces, fi: number): RWall[] {
  const mids = wf.faces[fi]!.loop.map(edgeMid);
  const ids = new Set<string>();
  for (const s of ctx.wallSegs) {
    if (mids.some((m) => distPointToWallSegment(m, s) <= s.thickness / 2 + 1)) ids.add(s.wallId);
  }
  return ctx.ir.walls.filter((w) => ids.has(w.id));
}

/**
 * The rooms just beyond a face's walls: from the middle of each edge of its boundary, the
 * room whose floor holds the point one wall thickness (and {@link RUN_PROBE_MM}) outward.
 */
function roomsBeyond(ctx: LintContext, wf: WallFaces, fi: number): RRoom[] {
  const found = new Set<string>();
  for (const e of wf.faces[fi]!.loop) {
    const m = edgeMid(e);
    const t = edgeTangentAt(e, m);
    const n = { x: -t.y, y: t.x };
    const inward = wf.faceAt({ x: m.x + n.x, y: m.y + n.y }) === fi ? 1 : -1;
    let thick = 0;
    for (const s of ctx.wallSegs)
      if (distPointToWallSegment(m, s) <= s.thickness / 2 + 1) thick = Math.max(thick, s.thickness);
    const d = -inward * (thick + RUN_PROBE_MM);
    const probe = { x: m.x + n.x * d, y: m.y + n.y * d };
    for (const r of ctx.rooms) if (pointInRoomBox(probe, ctx.roomRects.get(r.id)!)) found.add(r.id);
  }
  return ctx.rooms.filter((r) => found.has(r.id));
}

/** Everything that assigns floor though it is no room: outdoor surfaces, voids and vertical runs. */
function nonRoomCover(ctx: LintContext): FaceRoom[] {
  const out: FaceRoom[] = [];
  for (const e of ctx.ir.elements) {
    if (e.kind === "outdoor")
      out.push({
        id: e.id,
        at: e.at,
        size: e.size,
        ...(e.poly ? { poly: e.poly } : {}),
      });
    else if (e.kind === "void") out.push({ id: e.id, at: e.at, size: e.size });
  }
  for (const v of ctx.verticals) out.push({ id: v.id, at: v.at, size: v.size });
  return out;
}

/**
 * `W_FLOOR_UNASSIGNED`: a walled face that rooms (with outdoor surfaces, voids and vertical
 * runs) cover less than `minFaceCoverRatio` of, leaving at least `minUnassignedM2` in no room.
 * A sealed face — no door or cased opening into it and no room on its empty floor — is not
 * reported. One warning per face, in the outline's canonical order, on the first room that
 * borders the empty floor (else the first wall round it).
 */
export const floorUnassigned: LintRule = {
  name: "floor-unassigned",
  check(ctx: LintContext): Diagnostic[] {
    if (ctx.rooms.length === 0) return [];
    const wf = facesOf(ctx.ir);
    if (!wf || wf.faces.length === 0) return [];
    // Reported in SOURCE order of the element each warning sits on (a bordering room, else a
    // wall round the face), never the outline's order, which follows coordinates and so moves
    // under a turn or a mirror of the plan. Ties keep the measured areas' order.
    const found: Array<{ key: [number, number, number]; d: Diagnostic }> = [];
    const extra = nonRoomCover(ctx);
    const cover = [...ctx.rooms, ...extra];
    for (let fi = 0; fi < wf.faces.length; fi++) {
      const c = faceCover(wf, fi, cover);
      if (!c) continue;
      const covered = 1 - c.unassigned / c.area;
      if (covered >= ctx.rules.minFaceCoverRatio - EPS) continue;
      if (c.unassigned / 1_000_000 < ctx.rules.minUnassignedM2 - EPS) continue;
      const bordering = c.bordering.filter((k) => k < ctx.rooms.length).map((k) => ctx.rooms[k]!);
      if (bordering.length === 0 && !faceHasWayIn(ctx, wf, fi)) continue;
      const walls = wallsRound(ctx, wf, fi);
      const beyond = bordering.length === 0 ? roomsBeyond(ctx, wf, fi) : [];
      const names = (rs: readonly RRoom[]): string => listOf(rs.map((r) => `"${ctx.labelOf(r)}"`));
      const where =
        bordering.length > 0
          ? ` next to ${names(bordering)}`
          : beyond.length > 0
            ? `, behind the walls of ${names(beyond)},`
            : "";
      const pct = Math.floor(covered * 1000) / 10;
      const site = bordering[0] ?? walls[0];
      const authored = walls.filter((w) => w._idAuthored === true).map((w) => `"${w.id}"`);
      const idHint = [
        bordering.length > 0 ? `The rooms are ${bordering.map((r) => `"${r.id}"`).join(", ")}` : "",
        authored.length > 0 ? `the walls round it are ${authored.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("; ");
      const siteKey =
        bordering.length > 0
          ? ctx.rooms.indexOf(bordering[0]!)
          : ctx.rooms.length + (walls[0] ? ctx.ir.walls.indexOf(walls[0]) : ctx.ir.walls.length);
      found.push({
        key: [siteKey, -Math.round(c.unassigned), -Math.round(c.area)],
        d: {
          severity: "warning",
          code: "W_FLOOR_UNASSIGNED",
          ...(site ? ctx.at(site) : {}),
          message: `${fmt2(Math.round(c.unassigned / 10_000) / 100)} m² of walled floor${where} is in no room: the walls there enclose ${fmt2(Math.round(c.area / 10_000) / 100)} m² and rooms cover ${fmt2(pct)} % of it, under ${fmt2(ctx.rules.minFaceCoverRatio * 100)} %. Floor inside the walls that no room claims has no use, no area and no route the plan can check.`,
          hints: [
            bordering.length > 0
              ? `Extend ${listOf(bordering.map((r) => `"${ctx.labelOf(r)}"`))} over it, draw a room on it, or move the walls in to the rooms' edges.`
              : "Draw a room on it, or move the walls so they enclose only rooms.",
            "If it is open ground (a courtyard, a light well), draw it as an `outdoor` surface; if it is a void or a shaft, draw that `void` or stair.",
            ...(idHint ? [`${idHint}.`] : []),
          ],
        },
      });
    }
    found.sort((p, q) => p.key[0] - q.key[0] || p.key[1] - q.key[1] || p.key[2] - q.key[2]);
    return found.map((x) => x.d);
  },
};

/**
 * `W_ROOM_OUTSIDE_SHELL`: a room with at least `minOutsideShellM2` of its floor outside the
 * building — off every walled face and every wall body. Silent on a storey whose walls close
 * no face (no shell: refuse, never guess). One warning per room, in source order.
 */
export const roomOutsideShell: LintRule = {
  name: "room-outside-shell",
  check(ctx: LintContext): Diagnostic[] {
    if (ctx.rooms.length === 0) return [];
    const wf = facesOf(ctx.ir);
    if (!wf || wf.faces.length === 0) return [];
    const out: Diagnostic[] = [];
    for (const r of ctx.rooms) {
      const o = roomOutside(wf, r);
      if (!o || o.area / 1_000_000 < ctx.rules.minOutsideShellM2 - EPS) continue;
      const m2 = fmt2(Math.round(o.area / 10_000) / 100);
      const depth = o.depth >= 0.5 ? `, up to ${mm(o.depth)} mm past their outer face` : "";
      out.push({
        severity: "warning",
        code: "W_ROOM_OUTSIDE_SHELL",
        ...ctx.at(r),
        message: `Room "${ctx.labelOf(r)}" has ${m2} m² of its floor outside the building's walls${depth}. A room drawn past the outside wall has floor no wall encloses, usually a room resized or moved while its walls stayed put.`,
        hints: [
          `Bring "${ctx.labelOf(r)}" back inside the walls (resize or move it so its edge meets the outside wall), or move the outside wall out to the room's edge.`,
          "Accept it if that part is meant to be outside (a terrace, a balcony, a porch): draw it as an `outdoor` surface rather than a room.",
          `The room is "${r.id}".`,
        ],
      });
    }
    return out;
  },
};
