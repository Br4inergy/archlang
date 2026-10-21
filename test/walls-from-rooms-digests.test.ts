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
  ["two-bed-twin", "92a53fbac3c5fb75dfdb999e101d9167dec6c5c35222febdbf2c1e1369b02067"],
  ["widen-4000", "8f10a20c86ffc919a72b6bb7912c7fffea0f953f46777d3f84a598582c67209e"],
  ["widen-4500", "c50d7c02d2f34d92da146950a02856fa53648b2d961314cc29db95d97e78012d"],
  ["courtyard", "7db77fbb50cf24659f402e0ef09e2e15ebffa9d5833b9d1a16513dedf6a5fb4e"],
  ["void-hole", "d66a420fdca3a21429b331389715f2d723e934a1c56df73cb10ca0676f15789a"],
  ["instances", "00fbb27c01b89e46510de799b05a6bde359bc5baf0c18c623ab79609dd04b19d"],
  ["coexist", "ad84cacd155fe30a10560c26299bbfac28b638abcb4bfc508853370289f35e6e"],
  ["refused", "2be9eba41c04c8a8dbcd0c5d0534949a49916bb205ed091b71f748897968af21"],
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
