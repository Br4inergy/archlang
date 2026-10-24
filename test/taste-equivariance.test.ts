/**
 * The taste equivariance law (ADR 0032; design §4): `taste()` is INVARIANT under a pure
 * translation and under every D4 frame applied with `north` carried along, and under a D4
 * frame with `north` fixed on a plan with no `site` (nothing taste reads is a compass fact
 * there). The frames are the equivariance oracle's own (`./d4-oracle.ts`): P₀ is the example
 * placed whole by `place … as g`, gP the same placement turned or mirrored, so every id is
 * `g.<id>` on both sides and the reports compare byte for byte.
 *
 * One part of the report is compared under the translation only: `validity.drafting`, the
 * drafting-layer lint findings. `W_ANNOTATION_OVERLAP` (PS2.12) reads the drawn sheet, whose text
 * stays upright when the building turns or flips, so where a label lands relative to a symbol is
 * a fact about the page (the d4 oracle's `sheet` class). It never caps and never scores, so the
 * score, the criteria and the validity verdict are still compared under every frame.
 */

import { describe, expect, it } from "vitest";
import { taste } from "../src/index.js";
import {
  astOf,
  corpusElements,
  D4_TEST_ELEMENTS,
  ELIGIBLE_EXAMPLES,
  EXAMPLES_WORLD,
  rotateNorth,
  wrapperSource,
} from "./d4-oracle.js";

/** The report as compared; with `sheet` false, its sheet-reading part is left out (see above). */
const report = (src: string, sheet = true): string => {
  const r = taste(src, { world: EXAMPLES_WORLD }) as { validity?: { drafting?: unknown } };
  if (!sheet && r.validity) r.validity = { ...r.validity, drafting: "compared under translation only" };
  return JSON.stringify(r);
};

describe("taste() is invariant under translation and D4", () => {
  it("covers the oracle's corpus", () => {
    expect(ELIGIBLE_EXAMPLES.length).toBeGreaterThan(20);
  });

  for (const rel of ELIGIBLE_EXAMPLES) {
    it(rel, () => {
      const ast = astOf(rel);
      const p0 = report(wrapperSource(rel, null));
      const p0Turned = report(wrapperSource(rel, null), false);
      expect(JSON.parse(p0).ok, `${rel} resolves when placed`).toBe(true);
      const site = ast.site !== undefined;
      // Proper rotations with north carried along, and the translation, on every example;
      // mirrors (whose compass cannot be carried by a turn of `north`) only on a plan with no site.
      const elements = [
        ...D4_TEST_ELEMENTS.filter((g) => g.name !== "e" && !g.mirror),
        ...(site ? [] : corpusElements(rel).filter((g) => g.mirror)),
      ];
      const moved: string[] = [];
      for (const g of elements) {
        const north = g.translate ? ast.north : rotateNorth(ast.north, g.rotate / 90);
        const sheet = g.translate === true;
        if (report(wrapperSource(rel, g, { north }), sheet) !== (sheet ? p0 : p0Turned)) moved.push(g.name);
      }
      expect(moved).toEqual([]);
    }, 120_000);
  }
});
