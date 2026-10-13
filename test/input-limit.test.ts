/**
 * `inputTooLarge()` — a host's byte-cap refusal as a catalogued diagnostic.
 *
 * The hosted MCP Worker raises it before compiling; `compile()` never does (its budgets are
 * counts), which is why the catalog example is excused in error-catalog-examples.test.ts and the
 * code is pinned here instead.
 */
import { describe, expect, it } from "vitest";
import { compile, diagnosticToJson, ERROR_CATALOG, inputTooLarge, utf8ByteLength } from "../src/index.js";

describe("utf8ByteLength", () => {
  it("agrees with TextEncoder on every width, including lone surrogates", () => {
    const samples = ["", "a", "é", "厨房", "🏠", "a🏠b", "\ud800", "\udc00x", "x\ud83d", 'plan "P" { }'];
    for (const s of samples) expect(utf8ByteLength(s), JSON.stringify(s)).toBe(new TextEncoder().encode(s).length);
  });
});

describe("inputTooLarge", () => {
  it("is silent at and under the cap, and refuses one byte over it", () => {
    expect(inputTooLarge("x".repeat(10), 10)).toBeUndefined();
    const d = inputTooLarge("x".repeat(11), 10);
    expect(d?.code).toBe("E_INPUT_TOO_LARGE");
    expect(d?.severity).toBe("error");
    expect(d?.span).toBeUndefined();
    expect(d?.message).toBe("source is 11 bytes; this host compiles at most 10");
  });

  it("counts bytes, not UTF-16 units: four 3-byte characters are 12 bytes", () => {
    expect(inputTooLarge("厨房厨房", 11)?.code).toBe("E_INPUT_TOO_LARGE");
    expect(inputTooLarge("厨房厨房", 12)).toBeUndefined();
  });

  it("projects to JSON with the catalogued fix and no location", () => {
    const j = diagnosticToJson("", inputTooLarge("xx", 1, "plan_json")!);
    expect(j).toEqual({
      code: "E_INPUT_TOO_LARGE",
      severity: "error",
      message: "plan_json is 2 bytes; this host compiles at most 1",
      fix: ERROR_CATALOG.E_INPUT_TOO_LARGE!.fix,
    });
  });

  it("compile() itself never raises it, however large the source", () => {
    const big = `plan "Big" {\n${'  room at (0,0) size 1000x1000 label "R"\n'.repeat(2000)}}\n`;
    expect(utf8ByteLength(big)).toBeGreaterThan(64 * 1024);
    expect(compile(big, { noCache: true }).diagnostics.map((d) => d.code)).not.toContain("E_INPUT_TOO_LARGE");
  });
});
