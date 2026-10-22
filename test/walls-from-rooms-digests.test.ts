/**
 * The `walls from rooms` digest table (ADR 0028 §3; card PS3.0 part B): SHA-256 over SVG,
 * `describe()`, `lint()` and `compile().diagnostics` of every storey of each plan in
 * `test/walls-from-rooms-plans.ts`, pinned in its own commit after the byte-identity law held
 * (every existing digest suite unchanged, the twins byte-identical in SVG and lint,
 * `test/walls-from-rooms.test.ts`). Measured with the test's own digest body
 * (`allStoreysDigestWithDiagnostics`). A moved row is a finding to explain
 * (`docs/testing.md` §3), never a re-pin.
 */

import { describe as suite, expect, it } from "vitest";
import { compile, describe, lint } from "../src/index.js";
import { allStoreysDigestWithDiagnostics, type CompilerApi } from "./byte-identity-digest.js";
import { WALLS_FROM_ROOMS_PLANS } from "./walls-from-rooms-plans.js";

const API: CompilerApi = { compile, describe, lint };

const DIGESTS: [string, string][] = [
  ["studio-twin", "25ad0dd4d393d4c72288a9ff004ff8aaef8e750e376f1da53136237322bba1d5"],
  // Re-pinned for PS3.6: the twin is now the hand-typed twin of the rewritten two-bed (a
  // different plan); the previous twin under this compiler reproduces the previous row.
  ["two-bed-twin", "bde125dcab98214a69781e03a9e33f4143f68197b78d215397a282f207e36af8"],
  ["widen-4000", "8f10a20c86ffc919a72b6bb7912c7fffea0f953f46777d3f84a598582c67209e"],
  ["widen-4500", "c50d7c02d2f34d92da146950a02856fa53648b2d961314cc29db95d97e78012d"],
  ["courtyard", "7db77fbb50cf24659f402e0ef09e2e15ebffa9d5833b9d1a16513dedf6a5fb4e"],
  ["void-hole", "d66a420fdca3a21429b331389715f2d723e934a1c56df73cb10ca0676f15789a"],
  ["instances", "00fbb27c01b89e46510de799b05a6bde359bc5baf0c18c623ab79609dd04b19d"],
  ["coexist", "ad84cacd155fe30a10560c26299bbfac28b638abcb4bfc508853370289f35e6e"],
  ["refused", "2be9eba41c04c8a8dbcd0c5d0534949a49916bb205ed091b71f748897968af21"],
  // Part C, the pair clauses: pinned after the twins held (`test/walls-from-rooms-clauses.test.ts`).
  // Re-pinned in red team round 1 (S1): the first pin carried a false W_OPENING_AT_JUNCTION (a
  // 25 mm "nib" beside the thinner wall at the a|c (150) / b|c (100) end); with the HEAD rule
  // restored the old digest reproduces exactly, so the rule fix is the only change.
  ["open-plan", "2181822b798d5774d2ba30a928d5fe9f8e814dcbaa797e14cab1e28cfa696762"],
  ["open-width", "b2413725d9053a145f68237e9bcd9dc872eb42a14615ff9869f98bac696539e0"],
  ["open-instances", "facae4205369cb92054da512779db81c3421f95743da3c819fd9997be3f94cd2"],
  ["clauses-refused", "2ee033192ebca84b6e8d593937ed348915530b2805b38f8d339ad7a5a6d6fe02"],
];

suite("walls from rooms: digest table", () => {
  it("pins every plan", () => {
    expect(DIGESTS.map((d) => d[0])).toEqual(WALLS_FROM_ROOMS_PLANS.map((p) => p[0]));
  });
  for (const [name, digest] of DIGESTS) {
    it(name, () => {
      const src = WALLS_FROM_ROOMS_PLANS.find((p) => p[0] === name)![1];
      expect(allStoreysDigestWithDiagnostics(API, src)).toBe(digest);
    });
  }
});
