import { describe, expect, it } from "vitest";
import { embedSnippets } from "../src/embed-snippets.js";

const BASE = "https://playground.archlang.uk/";
const HASH = "#z=q1YqLUktUrJSUFJSSs7PS8nMS1eyUjA0MjE1MDA0MDE2MDAwsLIyNjA0MDAwtbRUKkpVslJQUlICAA";

describe("embedSnippets", () => {
  it("links the Markdown snippet to the share URL, never as an image of embed.html", () => {
    const { markdown, shareUrl } = embedSnippets(BASE, HASH);
    expect(shareUrl).toBe(`${BASE}${HASH}`);
    expect(markdown).toBe(`[ArchLang floor plan — open it in the playground](${shareUrl})`);
    expect(markdown).not.toContain("![");
    expect(markdown).not.toContain("embed.html");
  });

  it("frames the embed page in the iframe snippet", () => {
    const { iframe, embedUrl } = embedSnippets(BASE, HASH);
    expect(embedUrl).toBe(`${BASE}embed.html${HASH}`);
    expect(iframe).toContain(`<iframe src="${embedUrl}"`);
    expect(iframe).toContain('title="ArchLang floor plan"');
  });

  it("keeps the plan in the fragment, so no snippet sends it to the server", () => {
    const { shareUrl, embedUrl } = embedSnippets(BASE, HASH);
    for (const url of [shareUrl, embedUrl]) {
      const u = new URL(url);
      expect(u.search).toBe("");
      expect(u.hash).toBe(HASH);
    }
  });
});
