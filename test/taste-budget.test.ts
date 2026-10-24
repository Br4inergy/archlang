/**
 * The taste budget is a COUNT set by measurement (ADR 0032; design §2.4), the way the step
 * budget was (ADR 0022, second addendum §3): `TASTE_BUDGET` is at least 1,000 times the largest
 * charge one `taste()` call makes over the examples, the defect corpus and the taste corpus.
 * The charge is each criterion's declared cost (an upper bound on its work), summed over the
 * call, charged before the work; a criterion that would overspend reports `taste-budget`.
 *
 * Measured on PS5.1a: the largest call charges {@link MEASURED_MAX} units. If the corpus grows a
 * plan that charges more, this test names it: re-measure, and raise the budget only with the
 * new measurement recorded here and in `TASTE_BUDGET`'s doc comment.
 */

import { describe, expect, it } from "vitest";
import { TASTE_BUDGET } from "../src/index.js";
import { tasteCharges } from "../src/taste/index.js";
import { TASTE_SOURCES, TASTE_WORLD } from "./taste-sources.js";

/** The largest per-call charge over the corpus when the budget was set. */
const MEASURED_MAX = { charge: 680, file: "examples/terrace-row.arch" };

describe("TASTE_BUDGET", () => {
  it("is at least 1,000 times the largest charge of any corpus plan, and the measurement still holds", () => {
    let max = 0;
    let file = "";
    for (const { name, src } of TASTE_SOURCES) {
      const charge = tasteCharges(src, { world: TASTE_WORLD }).reduce((a, b) => a + b, 0);
      if (charge > max) {
        max = charge;
        file = name;
      }
    }
    console.log(
      `taste budget: largest corpus charge ${max} (${file}); budget ${TASTE_BUDGET} = ${TASTE_BUDGET / max}×`,
    );
    expect(
      max,
      `${file} charges more than the measured maximum (${MEASURED_MAX.file}): re-measure`,
    ).toBeLessThanOrEqual(MEASURED_MAX.charge);
    expect(TASTE_BUDGET).toBeGreaterThanOrEqual(1000 * MEASURED_MAX.charge);
  }, 300_000);
});
