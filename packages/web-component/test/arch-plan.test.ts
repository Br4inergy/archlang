/**
 * `<arch-plan>` in a real DOM (jsdom): the element, not a stand-in, upgraded by
 * `customElements`, rendering into its shadow root. The core it imports is the repo's
 * SOURCE (vitest.config.ts aliases `@chanmeng666/archlang`), so this needs no build.
 */
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ArchPlanElement, ArchPlanRenderDetail } from "../src/arch-plan.js";

const STUDIO = readFileSync(new URL("../../../examples/studio.arch", import.meta.url), "utf8");
const TWO_STOREY = readFileSync(new URL("../../../examples/two-storey.arch", import.meta.url), "utf8");
const BROKEN = 'plan "Broken" {\n  room id=r at (0,0) size\n}\n';

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://example.test/" });
const GLOBALS = ["window", "document", "HTMLElement", "customElements", "MutationObserver", "CustomEvent", "Node"];
const saved = new Map<string, unknown>();
const fetchMock = vi.fn<(input: string) => Promise<Response>>();

beforeAll(async () => {
  for (const name of GLOBALS) {
    saved.set(name, (globalThis as Record<string, unknown>)[name]);
    (globalThis as Record<string, unknown>)[name] = (dom.window as unknown as Record<string, unknown>)[name];
  }
  vi.stubGlobal("fetch", fetchMock);
  // Warm the module graph: the element imports the core lazily on its first render, and a cold
  // transform of the whole compiler would otherwise be charged to whichever case runs first.
  await import("@chanmeng666/archlang");
  await import("../src/arch-plan.js"); // defines <arch-plan> on the jsdom window
}, 120_000);

afterAll(() => {
  vi.unstubAllGlobals();
  for (const [name, value] of saved) (globalThis as Record<string, unknown>)[name] = value;
  dom.window.close();
});

/** Mount an element, wait for its render, and return its shadow root. */
async function mount(setup: (el: ArchPlanElement) => void): Promise<{ el: ArchPlanElement; root: ShadowRoot }> {
  const el = dom.window.document.createElement("arch-plan") as ArchPlanElement;
  setup(el);
  dom.window.document.body.append(el);
  await el.updateComplete;
  return { el, root: el.shadowRoot! };
}

describe("<arch-plan>", () => {
  it("is a defined custom element with an open shadow root", () => {
    expect(dom.window.customElements.get("arch-plan")).toBeTypeOf("function");
    expect(dom.window.document.createElement("arch-plan").shadowRoot).not.toBeNull();
  });

  it("renders examples/studio.arch, given inline, as an <svg> in its shadow root", async () => {
    const { root } = await mount((el) => {
      el.textContent = STUDIO;
    });
    expect(root.querySelector("pre")).toBeNull();
    const svg = root.querySelector(".plan > svg");
    expect(svg).not.toBeNull();
    expect(root.innerHTML).toContain("<svg");
    // Accessible output: the plan's own name as the drawing's <title>.
    expect(svg!.querySelector("title")?.textContent).toBe("Studio 1BR");
  });

  it("fetches `src` and renders it", async () => {
    fetchMock.mockResolvedValueOnce(new Response(STUDIO, { status: 200 }));
    const { root } = await mount((el) => el.setAttribute("src", "https://example.test/studio.arch"));
    expect(fetchMock).toHaveBeenLastCalledWith("https://example.test/studio.arch");
    expect(root.querySelector(".plan > svg")).not.toBeNull();
  });

  it("renders a broken plan as a <pre> with E_PARSE and line:col, and never throws", async () => {
    const events: ArchPlanRenderDetail[] = [];
    const { root } = await mount((el) => {
      el.addEventListener("render", (e) => events.push((e as CustomEvent<ArchPlanRenderDetail>).detail));
      el.textContent = BROKEN;
    });
    expect(root.querySelector("svg")).toBeNull();
    const pre = root.querySelector("pre");
    expect(pre?.textContent).toMatch(/^E_PARSE 3:1 Expected a value but found "}"$/m);
    expect(events.at(-1)?.ok).toBe(false);
  });

  it("reports a failed fetch in the <pre>", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404 }));
    const { root } = await mount((el) => el.setAttribute("src", "https://example.test/missing.arch"));
    expect(root.querySelector("pre")?.textContent).toBe(
      "arch-plan: could not fetch https://example.test/missing.arch (HTTP 404)",
    );
  });

  it("re-renders when an attribute changes: `level` picks a storey, an absent one is reported", async () => {
    const { el, root } = await mount((e) => {
      e.textContent = TWO_STOREY;
    });
    const first = root.querySelector(".plan")!.innerHTML;
    el.setAttribute("level", "2");
    await el.updateComplete;
    const second = root.querySelector(".plan")!.innerHTML;
    expect(second).toContain("<svg");
    expect(second).not.toBe(first);
    el.setAttribute("level", "9");
    await el.updateComplete;
    expect(root.querySelector("pre")?.textContent).toBe(
      'arch-plan: level="9" is not a storey of this plan (its levels are 1, 2)',
    );
  });

  it("`theme` selects a built-in theme; an unknown name is reported", async () => {
    const { el, root } = await mount((e) => {
      e.textContent = STUDIO;
    });
    const plain = root.querySelector(".plan")!.innerHTML;
    el.setAttribute("theme", "blueprint");
    await el.updateComplete;
    expect(root.querySelector(".plan")!.innerHTML).toContain("#0b3d6b");
    expect(root.querySelector(".plan")!.innerHTML).not.toBe(plain);
    el.setAttribute("theme", "nope");
    await el.updateComplete;
    expect(root.querySelector("pre")?.textContent).toMatch(/^arch-plan: unknown theme "nope" \(known: .*blueprint/);
  });

  it("re-renders when its inline text changes", async () => {
    const { el, root } = await mount((e) => {
      e.textContent = BROKEN;
    });
    expect(root.querySelector("pre")).not.toBeNull();
    el.textContent = STUDIO;
    await vi.waitFor(() => expect(root.querySelector(".plan > svg")).not.toBeNull());
  });
});
