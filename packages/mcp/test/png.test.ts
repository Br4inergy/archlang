/**
 * `compile`'s png path when the renderer is ABSENT, and the one sentence that says so.
 *
 * The core's renderer is mocked to fail exactly as the core does without `@resvg/resvg-js`, so
 * the refusal is pinned on every machine, renderer installed or not. The bundle half is pinned
 * through the build's own check: the bundled `compile` must carry `PNG_NOT_IN_BUNDLE`, the same
 * string the call returns, and the bundle must keep the renderer out.
 *
 * The same mocked core also stands in for one OLDER than this shim, whose `planToJson` has no
 * per-storey `pages`: `format:"json"` on a multi-storey plan must say so, not repeat the ground floor.
 */
import { ERROR_CATALOG } from "@chanmeng666/archlang";
import { describe, expect, it, vi } from "vitest";
import { assertBundleSaysNoPng, MCPB_EXTERNAL } from "../scripts/build-mcpb.js";
import {
  compilePngSentence,
  IN_MCPB_BUNDLE,
  PNG_NEEDS_RENDERER,
  PNG_NOT_IN_BUNDLE,
  PNG_RENDERER,
  pngUnavailable,
} from "../src/png.js";
import { call, connect, TWO_ROOMS, TWO_STOREY } from "./helpers.js";

vi.mock("@chanmeng666/archlang", async (importOriginal) => {
  const core = await importOriginal<typeof import("@chanmeng666/archlang")>();
  return {
    ...core,
    // The core's own message when the lazy import fails (src/backends/png.ts).
    renderPng: async () => {
      throw new Error(
        "PNG export needs the optional dependency '@resvg/resvg-js'. Install it: npm install @resvg/resvg-js",
      );
    },
    // An older core: the projection without `pages`.
    planToJson: (...args: Parameters<typeof core.planToJson>) => {
      const { pages: _pages, ...older } = core.planToJson(...args);
      return older;
    },
  };
});

describe("compile json against a core older than the shim", () => {
  it("refuses a multi-storey projection as data; a single storey is unaffected", async () => {
    const client = await connect();
    const multi = await call(client, "compile", { source: TWO_STOREY, format: "json" });
    expect(multi.ok).toBe(false);
    expect(multi.error).toMatch(/^per-storey Plan JSON needs @chanmeng666\/archlang >= \d+\.\d+\.\d+/);
    const single = await call(client, "compile", { source: TWO_ROOMS, format: "json" });
    expect(single.ok).toBe(true);
  });
});

describe("compile png without the renderer", () => {
  it("returns the error as data, in the shared sentence, never an exception", async () => {
    const out = await call(await connect(), "compile", { source: TWO_ROOMS, format: "png" });
    expect(out).toMatchObject({ ok: false, format: "png", error: PNG_NEEDS_RENDERER, code: "E_PNG_DEPENDENCY" });
    expect(out.error).toContain(`npm i ${PNG_RENDERER}`);
    // As the CLI reports it: the catalogued code inside `diagnostics`, carrying the catalogue's fix.
    const diags = out.diagnostics as Array<{ code?: string; severity?: string; message?: string; fix?: string }>;
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ code: "E_PNG_DEPENDENCY", severity: "error", message: PNG_NEEDS_RENDERER });
    expect(diags[0]!.fix).toBe(ERROR_CATALOG.E_PNG_DEPENDENCY!.fix);
  });

  it("the npm build's description says what png returns and what it needs", async () => {
    const { tools } = await (await connect()).listTools();
    const compile = tools.find((t) => t.name === "compile")!;
    expect(IN_MCPB_BUNDLE).toBe(false);
    expect(compile.description).toContain(compilePngSentence(false));
    expect(compile.description).not.toContain(PNG_NOT_IN_BUNDLE);
    expect(compile.inputSchema.properties?.format).toMatchObject({ enum: ["svg", "txt", "json", "png"] });
  });
});

describe("the .mcpb bundle", () => {
  it("leaves the renderer out", () => {
    expect(MCPB_EXTERNAL).toContain(PNG_RENDERER);
  });

  it("states and returns ONE sentence: the description's png sentence is the error", () => {
    expect(compilePngSentence(true)).toBe(PNG_NOT_IN_BUNDLE);
    expect(pngUnavailable(true)).toBe(PNG_NOT_IN_BUNDLE);
    expect(pngUnavailable(false)).toBe(PNG_NEEDS_RENDERER);
  });

  it("the build refuses a bundle whose compile does not say png is unavailable", async () => {
    const { tools } = await (await connect()).listTools();
    // This registry is the npm build's, so its compile lacks the bundle sentence: the check fires.
    expect(() => assertBundleSaysNoPng(tools)).toThrow(/png is unavailable/);
    const bundled = tools.map((t) =>
      t.name === "compile" ? { ...t, description: `${t.description} ${PNG_NOT_IN_BUNDLE}` } : t,
    );
    expect(() => assertBundleSaysNoPng(bundled)).not.toThrow();
  });
});
