/**
 * The measures behind the clearance family of plan-soundness PS2.11 (`rules/clearances.ts`):
 * a WC's two side strips, and the band a window's span makes on its host wall. Stated once here
 * so the rules and the placement check every quoted position passes (`placementClear`,
 * `fixture-paste.ts`) read the same geometry: a hint never quotes a WC into a corner or a fridge
 * in front of a window that the rule would then report.
 *
 * Shapes, never bounding boxes: a piece's footprint is a quarter-turned rectangle, so its
 * rectangle is its shape; a wall is its straight body; a window is its span on its host.
 */

import { backEdgeOfDeg } from "../algebra/d4.js";
import type { Point } from "../ast.js";
import { DOOR_HEAD } from "../datum.js";
import { canonicalFixture } from "../elements/fixtures-glyphs.js";
import { cutPlaneLayer, isTallUnit } from "../fixtures-catalog.js";
import {
  area2,
  type ClearMeasure,
  type ClearWorld,
  clearStrips,
  clipToRect,
  measureStrip,
  type Strip,
} from "../furniture-relation.js";
import type { BBox } from "../geometry/rect.js";
import type { RFurniture, RWindow } from "../ir.js";
import type { LintContext } from "./context.js";
import { WALL_COLLISION_SLACK_MM } from "./measure.js";

/** Is this category a WC (the `wc` family: `wc`, `toilet`)? */
export const isWc = (category: string): boolean => canonicalFixture(category) === "wc";

/** The obstacles a WC's sides are measured against: the pieces at the cut plane (a mirror or a
 *  wall cabinet above, a rug below, are not beside the pan), every straight wall, and no door
 *  swing (a door clears by closing; `W_SWING_OBSTRUCTED` judges the leaf). */
export function wcWorld(furniture: readonly RFurniture[], ctx: Pick<LintContext, "wallSegs">): ClearWorld {
  return {
    furniture: furniture.filter((f) => cutPlaneLayer(f.category) === "body"),
    segments: ctx.wallSegs,
    swings: [],
  };
}

/** One side of a WC as measured: its strip and what stands in it (`by: null`: nothing within). */
export interface WcSide {
  strip: Strip;
  m: ClearMeasure;
}

/** A WC's two sides, measured `need − half` deep, or `null` when the pan is at least twice the
 *  figure wide (it clears the figure by itself). */
export interface WcSides {
  /** Half the pan's width: its centreline to either side face. */
  half: number;
  /** How deep each strip is measured: the figure less {@link half}. */
  depth: number;
  sides: [WcSide, WcSide];
}

/**
 * The two side strips of a pan `rect` at quarter-turn `turn`, `depth` deep, each pulled in from
 * the pan's BACK end by {@link WALL_COLLISION_SLACK_MM}: a pan drawn a few millimetres into the
 * wall it backs onto is flush by `W_FURNITURE_WALL_COLLISION`'s own tolerance, and that wall's
 * body must not then read as standing beside it.
 */
export function wcStrips(rect: BBox, turn: number | undefined, depth: number): [Strip, Strip] {
  const back = backEdgeOfDeg(turn);
  const inset = Math.min(WALL_COLLISION_SLACK_MM, (back === "top" || back === "bottom" ? rect.h : rect.w) / 2);
  const [a, b] = clearStrips(rect, turn, "sides", depth).map((s) =>
    back === "top" || back === "left" ? { ...s, lo: s.lo + inset } : { ...s, hi: s.hi - inset },
  );
  return [a!, b!];
}

/** Half a pan's width at quarter-turn `turn`: its centreline to either side face. */
export function wcHalf(rect: BBox, turn: number | undefined): number {
  const back = backEdgeOfDeg(turn);
  return (back === "top" || back === "bottom" ? rect.w : rect.h) / 2;
}

/** Measure a WC's sides against `world` (the pan itself, `self`, left out). */
export function measureWcSides(
  rect: BBox,
  turn: number | undefined,
  need: number,
  world: ClearWorld,
  self: RFurniture,
): WcSides | null {
  const half = wcHalf(rect, turn);
  const depth = need - half;
  if (depth <= 0) return null;
  const [a, b] = wcStrips(rect, turn, depth);
  return {
    half,
    depth,
    sides: [
      { strip: a, m: measureStrip(a, world, self) },
      { strip: b, m: measureStrip(b, world, self) },
    ],
  };
}

/** A side that is short: something stands in it nearer than the figure. */
export const isShort = (s: WcSide, depth: number): boolean => s.m.by !== null && s.m.measured < depth;

/** A window's band in its own frame: the centre of its span, the host's unit direction `d`
 *  and its normal `n`. */
export interface WindowBand {
  w: RWindow;
  c: Point;
  d: Point;
  n: Point;
}

/**
 * The windows a tall unit is judged against, as bands. A window with no host is
 * `W_WINDOW_OFF_WALL`'s; one whose sill is at or above a door head (2100 mm, `DOOR_HEAD`) is a
 * high window over full-height storage; one on a curved wall is not measured and `onCurved` is
 * told (the rule files the coverage skip).
 */
export function windowBands(windows: readonly RWindow[], onCurved: () => void = () => {}): WindowBand[] {
  const out: WindowBand[] = [];
  for (const w of windows) {
    const s = w.host;
    if (s === null || w.sill >= DOOR_HEAD) continue;
    if (s.arc) {
      onCurved();
      continue;
    }
    const len = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
    if (len === 0) continue;
    const d = { x: (s.b.x - s.a.x) / len, y: (s.b.y - s.a.y) / len };
    out.push({ w, c: w.at, d, n: { x: -d.y, y: d.x } });
  }
  return out;
}

/** How a footprint covers a window: the length of the span it stands in front of, and the
 *  footprint's own extent along the host, both measured from the window's centre. */
export interface WindowCover {
  covered: number;
  lo: number;
  hi: number;
}

/**
 * Does footprint `r` stand in front of the window: overlap, with positive area, the window's span
 * along its host within `tol` of the host's centreline on either side? Exact on an axis-aligned
 * host (a unit direction of 0 or ±1).
 */
export function windowCover(band: WindowBand, r: BBox, tol: number): WindowCover | null {
  const { w, c, d, n } = band;
  const local = [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ].map((p) => ({ x: (p.x - c.x) * d.x + (p.y - c.y) * d.y, y: (p.x - c.x) * n.x + (p.y - c.y) * n.y }));
  const clipped = clipToRect(local, { x: -w.width / 2, y: -tol, w: w.width, h: 2 * tol });
  if (clipped.length < 3 || Math.abs(area2(clipped)) <= 1e-9) return null;
  const xs = clipped.map((p) => p.x);
  const ls = local.map((p) => p.x);
  return { covered: Math.max(...xs) - Math.min(...xs), lo: Math.min(...ls), hi: Math.max(...ls) };
}

/**
 * Would a piece of `category` at footprint `fr` and turn `rotate` raise or worsen a clearance
 * finding? A WC whose own side is short; a piece standing nearer a WC's centreline than the
 * figure and nearer than what already stands there; a tall unit in front of a window. `self` is
 * the piece being moved, left out of every measure. The placement check behind quoted positions.
 */
export function clearancesClear(
  ctx: LintContext,
  fr: BBox,
  category: string,
  rotate: number,
  self?: RFurniture,
): boolean {
  const need = ctx.rules.wcSideClearanceMm;
  const others = ctx.furniture.filter((f) => f !== self);
  if (need !== null) {
    const probe = { at: { x: fr.x, y: fr.y }, size: { w: fr.w, h: fr.h }, rotate, category } as RFurniture;
    if (isWc(category)) {
      const m = measureWcSides(fr, rotate, need, wcWorld(others, ctx), probe);
      if (m?.sides.some((s) => isShort(s, m.depth))) return false;
    }
    if (cutPlaneLayer(category) === "body") {
      const alone: ClearWorld = { furniture: [probe], segments: [], swings: [] };
      for (const wc of others) {
        if (!isWc(wc.category)) continue;
        const r = { x: wc.at.x, y: wc.at.y, w: wc.size.w, h: wc.size.h };
        const now = measureWcSides(r, wc.rotate, need, wcWorld(others, ctx), wc);
        if (now === null) continue;
        for (const s of now.sides) {
          const by = measureStrip(s.strip, alone, wc);
          if (by.by !== null && by.measured < now.depth && by.measured <= s.m.measured) return false;
        }
      }
    }
  }
  if (isTallUnit(category)) {
    const tol = ctx.rules.fixtureWallTolMm;
    if (windowBands(ctx.windows).some((b) => windowCover(b, fr, tol) !== null)) return false;
  }
  return true;
}
