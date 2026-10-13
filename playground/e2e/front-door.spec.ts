import { expect, test } from "@playwright/test";
import { waitForPlan } from "./fixtures.js";

/**
 * The playground's front door: what a first visit on a phone, a small laptop or an agent
 * sees. Deliberately untagged (no `@prod`): `/llms.txt` is new, so the nightly run against
 * the live site would fail for a deploy lag that is not a bug.
 */
test.describe("front door", () => {
  for (const width of [390, 800]) {
    test(`the page never scrolls sideways at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      await waitForPlan(page);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(over, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
    });
  }

  test("the plan sits above the editor on a narrow screen and beside it on a wide one", async ({ page }) => {
    const tops = () =>
      page.evaluate(() => {
        const panes = [...document.querySelectorAll("main > .pane")].map((p) => p.getBoundingClientRect());
        return { editor: panes[0]!, plan: panes[1]! };
      });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForPlan(page);
    const narrow = await tops();
    expect(narrow.plan.top, "plan pane above the editor pane").toBeLessThan(narrow.editor.top);

    await page.setViewportSize({ width: 1280, height: 800 });
    const wide = await tops();
    expect(wide.plan.left, "plan pane right of the editor pane").toBeGreaterThan(wide.editor.left);
  });

  test("the first visit opens a plan with no diagnostics", async ({ page }) => {
    await page.goto("/");
    await waitForPlan(page);
    await expect(page.locator("#examples")).toHaveValue("Laneway House");
    await expect(page.locator("#errors")).toBeEmpty();
  });

  test("a link to the agents page sits beside Copy for LLM", async ({ page }) => {
    await page.goto("/");
    const link = page.locator("#agentsLink");
    await expect(link).toHaveAttribute("href", "https://archlang.uk/agents");
    await expect(link).toHaveAttribute("rel", /noopener/);
    // Same Share cell as Copy for LLM, not somewhere else in the header.
    const sameCell = await page.evaluate(
      () =>
        document.querySelector("#agentsLink")!.closest(".tb-cell") ===
        document.querySelector("#copyLlm")!.closest(".tb-cell"),
    );
    expect(sameCell).toBe(true);
  });

  test("serves /llms.txt pointing at the docs site's llms files", async ({ request }) => {
    const res = await request.get("/llms.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("https://archlang.uk/llms.txt");
    expect(body).toContain("https://archlang.uk/llms-full.txt");
  });
});
