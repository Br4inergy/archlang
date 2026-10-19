/**
 * The pieces that define a room of each use, read from `FURNISH_TABLE` (the table `finish`
 * furnishes from), and the checked statements that place them. Shared by
 * `W_ROOM_MISSING_DEFINING` (which reports a furnished room lacking one) and
 * `W_ROOM_NO_FIXTURE` (whose hint quotes them, so applying it leaves no defining piece missing).
 */

import { roomUses } from "../analyze.js";
import type { UseKind } from "../ast.js";
import { defaultFootprint } from "../fixtures-catalog.js";
import { FURNISH_TABLE, type FurnishItem } from "../furnish-table.js";
import type { RFurniture, RRoom } from "../ir.js";
import { LINT_RULES } from "./rules/index.js";
import type { LintContext } from "./context.js";
import { type PasteFailure, pasteFixture } from "./fixture-paste.js";

/**
 * Which pieces define a room of each use, as a reading of {@link FURNISH_TABLE}, so the lint
 * and the `finish` stage cannot disagree about what a room needs:
 * - `"required"`: every piece the row marks required;
 * - `{ pick }`: the row's items with these categories (each item brings its own `or` words);
 * - `{ none }`: not checked, and why.
 *
 * A use with no row is never checked. `test/lint-room-contents.test.ts` holds that every use
 * whose row marks a piece required has an entry here and that every pick names an item of its
 * row. Two readings differ from the required marks, on purpose:
 * - `bath` is defined by its bathtub-or-shower item, which the row marks optional (furnish
 *   leaves it out when it does not fit; the never-worse gate then refuses that bath, which stays
 *   empty and is `W_ROOM_NO_FIXTURE`'s report). A bath holding a shower and no WC is a shower
 *   room, not a defect.
 * - `wc` is defined by its WC alone: a cloakroom without a basin is common.
 *
 * Kitchen: the row's required marks are a sink, a hob/stove and a worktop (`counter`, or
 * `worktop`; plan-soundness PS2.17), so a kitchen whose sink, hob and fridge are butted together
 * with nowhere to prepare food is reported (`test/defect-corpus/missing-defining-contents/
 * kitchen-no-worktop.arch`), and `finish` writes the worktop with them or leaves the kitchen out.
 */
export const DEFINING: Readonly<Partial<Record<UseKind, "required" | { pick: readonly string[] } | { none: string }>>> =
  Object.freeze({
    bedroom: "required",
    dining: "required",
    kitchen: "required",
    bath: { pick: ["bathtub"] },
    wc: { pick: ["wc"] },
    living: {
      none: "a living room is furnished many ways (armchairs, a piano, floor cushions); no one piece defines it",
    },
    office: { none: "a study can be a reading room with no desk; no one piece defines it" },
  });

/** The items, each satisfied by any one of its words, that define a room of `use`. */
export function definingItems(use: UseKind): FurnishItem[] {
  const row = FURNISH_TABLE[use];
  const spec = DEFINING[use];
  if (row === undefined || spec === undefined || (typeof spec === "object" && "none" in spec)) return [];
  if (spec === "required") return row.filter((i) => i.required);
  return spec.pick.flatMap((c) => row.filter((i) => i.category === c));
}

/** Every defining item of every use of the room, in the room's use order, each once. */
export function roomDefiningItems(r: RRoom): FurnishItem[] {
  const out: FurnishItem[] = [];
  for (const u of roomUses(r)) for (const i of definingItems(u)) if (!out.includes(i)) out.push(i);
  return out;
}

/** The room noun a message names a use by: "a bathroom", not "a bath room". */
const NOUN: Partial<Record<UseKind, string>> = {
  bedroom: "bedroom",
  dining: "dining room",
  kitchen: "kitchen",
  bath: "bathroom",
  wc: "WC",
};
export const useNoun = (use: UseKind): string => NOUN[use] ?? use;

/** An item's words: its category, then the ones tried in its place. */
export const itemWords = (i: FurnishItem): string[] => [i.category, ...(i.or ?? [])];

/**
 * The footprints a word of `item` is pasted at, in the order tried: every one of the item's
 * sizes for its own category (as `finish` tries them: a worktop's 600 mm module, then its
 * 400 mm one), else the catalogue's.
 */
function footprintsOf(item: FurnishItem, word: string): { along: number; depth: number }[] {
  const sizes = word === item.category ? item.sizes : undefined;
  if (sizes && sizes.length > 0) return sizes.map(([along, depth]) => ({ along, depth }));
  const fp = defaultFootprint(word);
  return fp ? [fp] : [];
}

/**
 * Statements that place every item in `room` TOGETHER: each is checked by {@link pasteFixture}
 * with the pieces quoted before it already standing, so applying all of them collides with
 * nothing the placement rules measure. Each item tries its words in order. When an item has no
 * clear position, nothing is quoted and the first such item is returned with the reason.
 */
export function pasteSet(
  ctx: LintContext,
  room: RRoom,
  items: readonly FurnishItem[],
):
  | { stmts: string[] }
  | { item: FurnishItem; footprint: { along: number; depth: number } | null; failure: PasteFailure } {
  const stmts: string[] = [];
  let here = ctx;
  for (const item of items) {
    let first: { footprint: { along: number; depth: number } | null; failure: PasteFailure } | null = null;
    let placed = false;
    for (const [w, fp] of itemWords(item).flatMap((w) => footprintsOf(item, w).map((fp) => [w, fp] as const))) {
      const paste = pasteFixture(here, room, w, fp.along, fp.depth);
      if ("stmt" in paste) {
        stmts.push(paste.stmt);
        const phantom = {
          kind: "furniture",
          id: `hint-piece-${stmts.length}`,
          category: w,
          at: { x: paste.rect.x, y: paste.rect.y },
          size: { w: paste.rect.w, h: paste.rect.h },
          rotate: paste.rotate,
          room: room.id,
        } as RFurniture;
        here = { ...here, furniture: [...here.furniture, phantom] };
        placed = true;
        break;
      }
      first ??= { footprint: fp, failure: paste.failure };
    }
    if (!placed)
      return {
        item,
        footprint: first?.footprint ?? footprintsOf(item, item.category)[0] ?? null,
        failure: first?.failure ?? "no-room",
      };
  }
  // Each piece is checked against what the placement rules measure, one at a time. The SET can
  // still raise what no single check sees: two pieces on different walls can squeeze the walk
  // below its minimum clear width (`W_PATH_TOO_NARROW`), and a kitchen fixture that now locates
  // the kitchen beside a bathroom door lets `W_WET_ROOM_DOOR` judge it. So the whole ruleset is
  // run once with the pieces standing, and a set that would add any finding other than the
  // room's own contents findings is not quoted: a hint that warns when pasted is worse than none.
  // Both runs use copies of the context that file no coverage notes and spend none of the
  // lint run's shared counted budgets (each copy counts its own `W_PATH_TOO_NARROW` door
  // attribution, as a single-storey plan's context does), so this check reports and changes
  // nothing outside itself; a nested hint (a rule run here quoting its own set) is not
  // verified again, so the extra work is two lint passes per quoted set, bounded by the rooms.
  if (stmts.length > 0 && !(VERIFYING in ctx)) {
    const quiet = (c: LintContext): LintContext =>
      ({
        ...c,
        skip: () => {},
        building: ownBudget(c.building),
        [VERIFYING]: true,
      }) as LintContext;
    const said = (c: LintContext): string[] =>
      LINT_RULES.flatMap((r) => r.check(quiet(c)))
        .filter((d) => d.code !== "W_ROOM_NO_FIXTURE" && d.code !== "W_ROOM_MISSING_DEFINING")
        .map((d) => `${d.code}|${d.message}`);
    const before = new Set(said(ctx));
    const gained = said(here).find((m) => !before.has(m));
    if (gained !== undefined) {
      const last = items[items.length - 1]!;
      return {
        item: last,
        footprint: footprintsOf(last, last.category)[0] ?? null,
        failure: gained.startsWith("W_PATH_TOO_NARROW|") ? "squeeze" : "raises",
      };
    }
  }
  return { stmts };
}

/** The building context without the lint run's shared attribution budget. */
function ownBudget(b: LintContext["building"]): LintContext["building"] {
  const { attributionMeasures: _shared, ...own } = b;
  return own;
}

/** Marks a context {@link pasteSet} built to re-lint a set with its pieces standing: a hint a
 *  rule quotes inside that run is not verified again. */
const VERIFYING = Symbol("pasteSet verifying");
