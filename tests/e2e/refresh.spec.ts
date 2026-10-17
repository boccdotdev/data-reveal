import { expect, initResult, scrollSettled, test } from "./helpers";

test.describe("a smooth scroll in progress", () => {
  test.beforeEach(async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("types"));
    expect(await initResult(page)).toBe("resolved");
    // Let the refresh the first init() scheduled finish, so it can't land
    // inside the scroll under test before the browser reports any scrolling.
    await page.waitForFunction(() => window.__reveal.refreshes > 0);
  });

  test("isn't stopped partway by refresh()", async ({ page }) => {
    const target = await page.evaluate(() => {
      const top = Math.min(4000, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo({ top, behavior: "smooth" });
      window.__reveal.instance?.refresh();
      return top;
    });
    // Within 20px: browsers can land a smooth scroll a few pixels short under
    // load, and one stopped partway is hundreds of pixels off.
    expect(Math.abs((await scrollSettled(page)) - target)).toBeLessThanOrEqual(20);
  });

  test("isn't stopped partway by init() of new content", async ({ page }) => {
    const target = await page.evaluate(() => {
      const top = Math.min(4000, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo({ top, behavior: "smooth" });
      const card = document.createElement("div");
      card.className = "box";
      card.dataset.reveal = "fade";
      card.dataset.revealDuration = "0.2";
      document.body.prepend(card);
      void window.__reveal.instance?.init(card);
      return top;
    });
    expect(Math.abs((await scrollSettled(page)) - target)).toBeLessThanOrEqual(20);
  });
});

test.describe("refresh()", () => {
  test("resolves once the positions have been worked out again", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("types"));
    expect(await initResult(page)).toBe("resolved");
    await page.waitForFunction(() => window.__reveal.refreshes > 0);

    const ran = await page.evaluate(async () => {
      const before = window.__reveal.refreshes;
      await window.__reveal.instance?.refresh();
      return window.__reveal.refreshes - before;
    });
    expect(ran).toBe(1);
  });

  test("resolves on a page with nothing to refresh", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("types", { params: { init: "0" } }));
    await page.waitForFunction(() => window.__reveal?.instance != null);

    await page.evaluate(() => window.__reveal.instance?.refresh());
    expect(await page.evaluate(() => window.__reveal.refreshes)).toBe(0);
  });
});
