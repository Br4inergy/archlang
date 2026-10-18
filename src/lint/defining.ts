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
 * Kitchen: the row's required marks are a sink and a hob/stove. A kitchen with no worktop
 * between them is a real defect (`test/defect-corpus/missing-defining-contents/
 * kitchen-no-worktop.arch`) that the row does not model yet. Until a counter is a required
 * kitchen mark (or a profile rule asks for one), no worktop is asked for, because `finish`
 * would otherwise write kitchens the lint reports.
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

/** An item's words: its category, then the ones tried in its place. */
export const itemWords = (i: FurnishItem): string[] => [i.category, ...(i.or ?? [])];

/** The footprint a word of `item` is pasted at: the item's first size for its own category, else the catalogue's. */
function footprintOf(item: FurnishItem, word: string): { along: number; depth: number } | null {
  const size = word === item.category ? item.sizes?.[0] : undefined;
  return size ? { along: size[0], depth: size[1] } : defaultFootprint(word);
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
    for (const w of itemWords(item)) {
      const fp = footprintOf(item, w);
      if (fp === null) continue;
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
        footprint: first?.footprint ?? footprintOf(item, item.category),
        failure: first?.failure ?? "no-room",
      };
  }
  return { stmts };
}
