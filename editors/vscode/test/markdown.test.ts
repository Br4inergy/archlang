/**
 * B6 — the Markdown-preview plugin (`src/markdown.ts`).
 *
 * Drives the REAL core (vitest aliases `@chanmeng666/archlang` to `src/index.ts`)
 * through a markdown-it-shaped stub: the plugin touches only `renderer.rules.fence`,
 * so the stub reproduces that contract (a fence rule over tokens) faithfully.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as archlang from "@chanmeng666/archlang";
import { installArchFence, type CoreCompile, type MarkdownItLike } from "../src/markdown.js";

const compile = archlang.compile as unknown as CoreCompile;
const DEFAULT_FENCE = "<pre><code>DEFAULT</code></pre>\n";

function render(info: string, content: string): string {
  const md: MarkdownItLike = { renderer: { rules: { fence: () => DEFAULT_FENCE } } };
  installArchFence(md, compile);
  const tokens = [{ info, content }];
  return md.renderer.rules.fence!(tokens, 0, {}, {}, {});
}

const studio = readFileSync(fileURLToPath(new URL("../../../examples/studio.arch", import.meta.url)), "utf8");

describe("markdown preview plugin", () => {
  it("renders an arch fence of examples/studio.arch as an inline <svg>", () => {
    const html = render("arch", studio);
    expect(html).toContain('<div class="archlang-preview">');
    expect(html).toContain("<svg");
    expect(html).not.toContain("<script");
  });

  it("tolerates archlang as an alias", () => {
    expect(render("archlang", studio)).toContain("<svg");
  });

  it("renders a broken fence as its diagnostic code, message and source, without an <svg", () => {
    const src = 'plan "x" { <bogus> }';
    const html = render("arch", src);
    expect(html).not.toContain("<svg");
    expect(html).toContain("E_PARSE");
    expect(html).toContain("&lt;bogus&gt;");
    expect(html).not.toContain("<bogus>");
  });

  it("leaves a non-arch fence to the default renderer", () => {
    expect(render("js", "let x = 1")).toBe(DEFAULT_FENCE);
    expect(render("", "plain")).toBe(DEFAULT_FENCE);
  });

  it("never throws, even when compile does", () => {
    const md: MarkdownItLike = { renderer: { rules: {} } };
    installArchFence(md, () => {
      throw new Error("boom");
    });
    const html = md.renderer.rules.fence!([{ info: "arch", content: "x" }], 0, {}, {}, {});
    expect(html).toContain("boom");
    expect(html).not.toContain("<svg");
  });
});
