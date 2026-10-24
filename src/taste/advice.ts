/**
 * The taste criteria's advice codes, names and sources (ADR 0032). `A_*` codes are advice, not
 * diagnostics: they never enter `lint()`, `describe()` or `src/error-catalog.ts`, and `arch
 * explain` does not know them yet. Every criterion has exactly one row here, with a code, a
 * source and the words its message is built from (`test/taste-advice.test.ts`).
 */

import type { TasteSubscore, TasteVerified } from "./report.js";

export interface TasteAdviceRow {
  /** The criterion id, `R<n>` as numbered in `docs/plans/plan-soundness/research/design-taste.md`. */
  id: string;
  name: string;
  subscore: TasteSubscore;
  /** The `A_*` code reported when the criterion scores below 1. */
  code: string;
  source: string;
  verified: TasteVerified;
  /** What the criterion asks, as the message's lead clause when it cannot judge. */
  asks: string;
}

/** In criterion (R-number) order. */
export const TASTE_ADVICE: readonly TasteAdviceRow[] = [
  {
    id: "R3",
    name: "intimacy-gradient",
    subscore: "zoning",
    code: "A_INTIMACY_INVERSION",
    source: "Alexander, A Pattern Language, 127 (intimacy gradient)",
    verified: "V",
    asks: "no living, dining or kitchen room deeper from the entrance than a bedroom",
  },
  {
    id: "R7",
    name: "daylight-ratio",
    subscore: "light",
    code: "A_DAYLIGHT_LOW",
    source: "IRC R303.1 (glazing at least 8 % of the floor area of a habitable room)",
    verified: "S",
    asks: "glazing of at least 8 % of the floor area in every habitable room",
  },
  {
    id: "R14",
    name: "common-area-at-heart",
    subscore: "circulation",
    code: "A_COMMON_AREA_PERIPHERAL",
    source: "Alexander, A Pattern Language, 129 (common areas at the heart); Hanson 1998 (integration)",
    verified: "V",
    asks: "a living or dining room among the best-integrated third of the rooms",
  },
];

/** The row of one criterion; throws on an id with no row (a programming error). */
export function adviceOf(id: string): TasteAdviceRow {
  const row = TASTE_ADVICE.find((r) => r.id === id);
  if (!row) throw new Error(`taste: no advice row for ${id}`);
  return row;
}
