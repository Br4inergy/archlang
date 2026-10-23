/**
 * The building-relative swing digest table (card PS3.8): SHA-256 over SVG, `describe()`, `lint()`
 * and `compile().diagnostics` of every storey of each plan in `test/swing-building-plans.ts`,
 * pinned in its own commit after every existing digest suite was unchanged by the form and after
 * the twins, frames and refusals in `test/swing-building.test.ts`. Measured with the test's own
 * digest body (`allStoreysDigestWithDiagnostics`). A moved row is a finding to explain
 * (`docs/testing.md` §3), never a re-pin.
 */

import { describe as suite, expect, it } from "vitest";
import { compile, describe, lint } from "../src/index.js";
import { allStoreysDigestWithDiagnostics, type CompilerApi } from "./byte-identity-digest.js";
import { SWING_BUILDING_PLANS } from "./swing-building-plans.js";

const API: CompilerApi = { compile, describe, lint };

const DIGESTS: [string, string][] = [
  ["k1-west-to-east", "48c187f2715ad8257d9681f53e254431db2abb498b82c1fe825a0eef30f93c5b"],
  ["k1-east-to-west", "d69f11af49fa0657c3a6da4811727e154626c1d660da578f8fbf324b0bfbcac2"],
  ["loop", "066803bb5243583247f8d5c9bccd6d5da2bb72b81c30d7a5a9fb4186bbad2431"],
  ["ring", "142352155d5a15bc0abf34193616bc01616adbbd9c3626bd421df54a6186a682"],
  ["frames", "56aab4eb879870ca283b5782a66d7fa3aac52c7591edc0b15da3a2cf4523a08d"],
  ["refused", "7ff180002fd7488d8b172c571d20c32004b4088a0617ec3d68efa229e0186952"],
];

suite("swing inward|outward: digest table", () => {
  it("pins every plan", () => {
    expect(DIGESTS.map((d) => d[0])).toEqual(SWING_BUILDING_PLANS.map((p) => p[0]));
  });
  it("only the refused plan has an error, and it raises both refusal families", () => {
    for (const [name, src] of SWING_BUILDING_PLANS) {
      const errs = new Set(
        compile(src)
          .diagnostics.filter((d) => d.severity === "error")
          .map((d) => d.code),
      );
      expect(errs, name).toEqual(name === "refused" ? new Set(["E_SWING_SIDE", "E_DOOR_KIND_CLAUSE"]) : new Set());
    }
  });
  for (const [name, digest] of DIGESTS) {
    it(name, () => {
      const src = SWING_BUILDING_PLANS.find((p) => p[0] === name)![1];
      expect(allStoreysDigestWithDiagnostics(API, src)).toBe(digest);
    });
  }
});
