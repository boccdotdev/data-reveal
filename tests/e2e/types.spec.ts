import { documentTop, expect, expectState, initResult, isClipped, opacities, revealDone, scrollTo, test } from "./helpers";

test.describe("every built-in type", () => {
  test.beforeEach(async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("types"));
    expect(await initResult(page)).toBe("resolved");
  });

  for (const type of ["fade", "scale", "blur", "rotate", "slide"]) {
    test(`${type} reveals once scrolled to and ends visible`, async ({ page }) => {
      const target = page.locator(`#${type}`);
      await expectState(target, "ready");
      await expect(target).toHaveCSS("opacity", "0");

      await scrollTo(target);
      await revealDone(target);
      await expect(target).toHaveCSS("opacity", "1");
    });
  }

  test("split reveals its characters once scrolled to", async ({ page }) => {
    const target = page.locator("#split");
    await expectState(target, "ready");
    expect(await opacities(target)).toContain("0");

    await scrollTo(target);
    await expect.poll(() => opacities(target)).not.toContain("0");
    expect(await opacities(target)).toEqual(expect.arrayContaining(["1"]));
    // Done once it has put the heading's own HTML back.
    await revealDone(target);
    await expect(target.locator("*")).toHaveCount(0);
  });

  test("batch reveals its items once scrolled to", async ({ page }) => {
    const target = page.locator("#batch");
    const items = target.locator("[data-reveal-item]");
    await expectState(target, "ready");
    await expect(items.first()).toHaveCSS("opacity", "0");

    await scrollTo(target);
    await revealDone(target);
    await expect(items.first()).toHaveCSS("opacity", "1");
    await expect(items.last()).toHaveCSS("opacity", "1");
    await expect(target).toHaveCSS("opacity", "1");
  });

  test("clip wipes in once scrolled to", async ({ page }) => {
    const target = page.locator("#clip");
    await expectState(target, "ready");
    expect(await isClipped(target)).toBe(true);

    await scrollTo(target);
    await revealDone(target);
    expect(await isClipped(target)).toBe(false);
    await expect(target).toHaveCSS("opacity", "1");
  });

  test("counter counts up once scrolled to", async ({ page }) => {
    const target = page.locator("#counter");
    await expectState(target, "ready");
    await expect(target).toHaveText("0");
    await expect(target).toHaveCSS("opacity", "1");

    await scrollTo(target);
    await revealDone(target);
    await expect(target).toHaveText("1,200");
  });

  test("parallax moves with the scroll and stays visible", async ({ page }) => {
    const target = page.locator("#parallax");
    await expectState(target, "ready");

    await scrollTo(target);
    const before = await documentTop(target);
    await page.evaluate(() => window.scrollBy(0, 200));
    await expect.poll(async () => Math.abs((await documentTop(target)) - before)).toBeGreaterThan(5);
    await expect(target).toHaveCSS("opacity", "1");
    // It never finishes.
    await expectState(target, "ready");
  });
});
