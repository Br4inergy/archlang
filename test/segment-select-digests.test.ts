/**
 * The segment-selector digest table (plan card PS3.5): SHA-256 over SVG, `describe()`, `lint()`
 * and `compile().diagnostics` of every storey of each plan in `test/segment-select-plans.ts`,
 * pinned in its own commit after the byte-identity law held (every existing digest suite was
 * unchanged by the selectors) and after the twins in `test/segment-select.test.ts`. Measured
 * with the test's own digest body (`allStoreysDigestWithDiagnostics`). A moved row is a finding
 * to explain (`docs/testing.md` §3), never a re-pin.
 */

import { describe as suite, expect, it } from "vitest";
import { compile, describe, lint } from "../src/index.js";
import { allStoreysDigestWithDiagnostics, type CompilerApi } from "./byte-identity-digest.js";
import { SEGMENT_SELECT_PLANS } from "./segment-select-plans.js";

const API: CompilerApi = { compile, describe, lint };

const DIGESTS: [string, string][] = [
  ["ring", "ad6106c7781b429cd5afaaac4d85699aba9a5282861fb4e704ff90674f23ee41"],
  ["open", "1723a1ffe1f0b548d4c2269592f37eec867b0043ba95a9d54161cde28eb88456"],
  ["derived", "c5f0ead8b2fa3c4e865add783c423bebf3ac49da58a1149adedefc134492d4c0"],
  ["frames", "71ade96f42c6cb47e91ed1f1fcb4e4dcfa2f918b66e7a0e6afd3ef5779fd75c7"],
  ["refused", "03d9a721e7e60f7afcfa6d42565b209bf2d9122e3fcd935142d39356fd124afb"],
  ["compass-refused", "bdfa0c557e5c3653610eee94b8f9f9c1983a262b0f91b31ea86e1a7f4708e741"],
];

suite("segment selectors: digest table", () => {
  it("pins every plan", () => {
    expect(DIGESTS.map((d) => d[0])).toEqual(SEGMENT_SELECT_PLANS.map((p) => p[0]));
  });
  it("the plans that select compile clean, and the refused ones raise their refusals", () => {
    const codesOf = (name: string) =>
      compile(SEGMENT_SELECT_PLANS.find((p) => p[0] === name)![1]).diagnostics.filter((d) => d.severity === "error");
    for (const name of ["ring", "open", "derived", "frames"]) expect(codesOf(name)).toEqual([]);
    expect(new Set(codesOf("refused").map((d) => d.code))).toEqual(
      new Set(["E_SEGMENT_SELECT", "E_UNKNOWN_REF", "E_ROOM_NOT_RECTANGLE"]),
    );
    expect(codesOf("compass-refused").map((d) => d.code)).toEqual(["E_DATUM_COMPASS"]);
  });
  for (const [name, digest] of DIGESTS) {
    it(name, () => {
      const src = SEGMENT_SELECT_PLANS.find((p) => p[0] === name)![1];
      expect(allStoreysDigestWithDiagnostics(API, src)).toBe(digest);
    });
  }
});
