/**
 * The taste budget is a COUNT set by measurement (ADR 0032; design §2.4), the way the step
 * budget was (ADR 0022, second addendum §3): `TASTE_BUDGET` is at least 1,000 times the largest
 * charge one `taste()` call makes over the examples, the defect corpus and the taste corpus.
 * The charge is each criterion's declared cost, summed over the call, charged before the work;
 * a criterion that would overspend reports `taste-budget`.
 *
 * A charge bounds work only if each declared cost really is an upper bound on what its judge
 * does. Each judge counts its work (one unit per loop step) on a counter, and the second law
 * here holds the counted work at or under the declared cost on every corpus plan and on a
 * generated probe plan, counted, never timed.
 *
 * Measured on PS5.1a: the largest call charges {@link MEASURED_MAX} units. If the corpus grows a
 * plan that charges more, this test names it: re-measure, and raise the budget only with the
 * new measurement recorded here and in `TASTE_BUDGET`'s doc comment.
 */

import { describe, expect, it } from "vitest";
import { taste, TASTE_BUDGET } from "../src/index.js";
import { tasteCharges, tasteWork } from "../src/taste/index.js";
import { TASTE_SOURCES, TASTE_WORLD } from "./taste-sources.js";

/** The largest per-call charge over the corpus when the budget was set. */
const MEASURED_MAX = { charge: 1559, file: "examples/terrace-row.arch" };

/**
 * A generated storey: a corridor along the south with `n` rooms off it, every fourth a living
 * room and the rest bedrooms, each with a door to the corridor and a window to the north.
 */
function probePlan(n: number): string {
  const lines = [
    `plan "Probe" {`,
    "  units mm",
    "  grid 100",
    `  room id=r_c at (0,4000) size ${n * 3000}x1500 label "Corridor" uses circulation`,
  ];
  for (let i = 0; i < n; i++)
    lines.push(
      `  room id=r_${i} at (${i * 3000},0) size 3000x4000 label "Room ${i}" uses ${i % 4 === 0 ? "living" : "bedroom"}`,
    );
  lines.push("  walls from rooms exterior 200 partition 100");
  lines.push("  door id=d_front on r_c.left at center width 900 swing into r_c");
  for (let i = 0; i < n; i++) {
    lines.push(`  door id=d_${i} between r_c and r_${i} at center width 900 swing into r_${i}`);
    lines.push(`  window id=w_${i} on r_${i}.top at center width 1200`);
  }
  lines.push("}");
  return lines.join("\n");
}

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

describe("each criterion's declared cost bounds the work its judge counts", () => {
  it("on every corpus plan", () => {
    const over: string[] = [];
    let judged = 0;
    for (const { name, src } of TASTE_SOURCES) {
      for (const w of tasteWork(src, { world: TASTE_WORLD })) {
        judged++;
        if (w.work > w.cost) over.push(`${name} ${w.id}: work ${w.work} > cost ${w.cost}`);
      }
    }
    expect(judged).toBeGreaterThan(400);
    expect(over).toEqual([]);
  }, 300_000);

  it("on a generated 40-room storey, where every criterion does real work", () => {
    const src = probePlan(40);
    const rows = tasteWork(src);
    expect(rows.map((r) => r.id)).toEqual(["R3", "R7", "R14"]);
    for (const r of rows) {
      expect(r.work, r.id).toBeGreaterThan(40);
      expect(r.work, `${r.id}: work ${r.work} > cost ${r.cost}`).toBeLessThanOrEqual(r.cost);
    }
    // Evidence is collected up to eight entries and counted past that: 40 habitable rooms.
    const r7 = taste(src).criteria.find((c) => c.id === "R7")!;
    expect(r7.evidence).toHaveLength(8);
    expect(r7.evidence_more).toBe(32);
  }, 120_000);
});
