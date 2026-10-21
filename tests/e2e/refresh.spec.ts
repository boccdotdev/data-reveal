import { documentTop, expect, frames, initResult, revealDone, scrollSettled, scrollTo, test } from "./helpers";

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
      return top;
    });
    // Under way before the new content arms, so its refresh lands mid-scroll.
    await page.waitForFunction(() => window.scrollY > 50);
    await page.evaluate(() => {
      const card = document.createElement("div");
      card.className = "box";
      card.dataset.reveal = "fade";
      card.dataset.revealDuration = "0.2";
      // At the end, as a load-more adds it. Content added above the viewport
      // shifts the page, and WebKit on Linux stops a smooth scroll for that
      // with no reveal on the page at all.
      document.body.append(card);
      void window.__reveal.instance?.init(card);
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

  test("moves a waiting reveal's start after a layout change made in JavaScript", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("types"));
    expect(await initResult(page)).toBe("resolved");
    await page.waitForFunction(() => window.__reveal.refreshes > 0);
    const fade = page.locator("#fade");
    const before = await documentTop(fade);

    // ScrollTrigger can't see this change on its own.
    await page.evaluate(async () => {
      const block = document.createElement("div");
      block.style.height = "3000px";
      document.getElementById("fade")?.before(block);
      await window.__reveal.instance?.refresh();
    });
    // Where it used to be is empty space now, so it doesn't play there...
    await page.evaluate((top) => window.scrollTo(0, top - window.innerHeight / 2), before);
    for (let i = 0; i < 5; i++) await frames(page);
    await expect(fade).toHaveCSS("opacity", "0");
    // ...but where it is now.
    await scrollTo(fade);
    await revealDone(fade);
  });

  test("resolves on a page with nothing to refresh", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("types", { params: { init: "0" } }));
    await page.waitForFunction(() => window.__reveal?.instance != null);

    await page.evaluate(() => window.__reveal.instance?.refresh());
    expect(await page.evaluate(() => window.__reveal.refreshes)).toBe(0);
  });
});
