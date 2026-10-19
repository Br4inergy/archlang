/**
 * Does the plan read as a dwelling? (plan-soundness PS2.18.)
 *
 * Three lint arms describe defects of a home, not of every building: a kitchen with no window
 * (`W_HABITABLE_NO_WINDOW`'s kitchen arm), a bath or WC door onto the dining room or living
 * space, or with no leaf, or a passage (`W_WET_ROOM_DOOR`, all but its kitchen arm), and a
 * front door into a bedroom or WC (`W_ENTRANCE_INTO_PRIVATE`). An office kitchenette, a café's
 * seating and a clinic's waiting room are not what they describe. Until rooms are grouped into
 * declared dwellings (PS2.14), the plan's rooms are read for positive evidence of another kind
 * of building, and a plan without it is a dwelling:
 *
 *  - a room whose use ({@link roomUses}) is `office`, and no room whose use is `bedroom` or
 *    `living` (a living room, an office and a bath drawn alone are a home's fragment with a
 *    study, not an office);
 *  - or a room whose label (else id, as {@link roomUses} reads it) carries one of
 *    `NON_RESIDENTIAL_WORDS` (`src/vocabulary.ts`: "Cafe seating", "Waiting / Reception",
 *    "Meeting Room").
 *
 * There is no "unknown": a plan that gives no such evidence is judged as before, so every
 * house, flat and studio (`uses living bedroom`) lints exactly as it did. The reading is
 * lint-only: `describe()` never reads it, and it adds no {@link UseKind}. One pass over the
 * rooms, each label matched against a fixed word list, so no step meter is needed.
 */

import type { UseKind } from "../ast.js";
import { roomUses } from "../analyze.js";
import { nonResidentialWord } from "../vocabulary.js";

/** What {@link dwellingReading} reads a plan as. */
export type DwellingReading = "dwelling" | "non-residential";

/** Read the plan's rooms (every storey's, for a multi-storey plan). */
export function dwellingReading(rooms: Iterable<{ label?: string; id: string; uses?: UseKind[] }>): DwellingReading {
  let office = false;
  let home = false;
  for (const r of rooms) {
    if (nonResidentialWord(r.label ?? r.id) !== null) return "non-residential";
    const u = roomUses(r);
    if (u.has("office")) office = true;
    if (u.has("bedroom") || u.has("living")) home = true;
  }
  return office && !home ? "non-residential" : "dwelling";
}
