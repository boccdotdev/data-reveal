import { expect, test } from "@playwright/test";
import { clipInsets, expectState, fixture, initResult, opacities, scrollTo } from "./helpers";

test.describe("every built-in type", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(fixture("types"));
    expect(await initResult(page)).toBe("resolved");
  });

  for (const type of ["fade", "scale", "blur", "rotate", "slide"]) {
    test(`${type} reveals once scrolled to and ends visible`, async ({ page }) => {
      const target = page.locator(`#${type}`);
      await expectState(target, "ready");
      await expect(target).toHaveCSS("opacity", "0");

      await scrollTo(target);
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
  });

  test("batch reveals its items once scrolled to", async ({ page }) => {
    const target = page.locator("#batch");
    const items = target.locator("[data-reveal-item]");
    await expectState(target, "ready");
    await expect(items.first()).toHaveCSS("opacity", "0");

    await scrollTo(target);
    await expect(items.first()).toHaveCSS("opacity", "1");
    await expect(items.last()).toHaveCSS("opacity", "1");
    await expect(target).toHaveCSS("opacity", "1");
  });

  test("clip wipes in once scrolled to", async ({ page }) => {
    const target = page.locator("#clip");
    await expectState(target, "ready");
    expect(await clipInsets(target)).not.toEqual([0]);

    await scrollTo(target);
    await expect.poll(() => clipInsets(target)).toEqual([0]);
    await expect(target).toHaveCSS("opacity", "1");
  });

  test("counter counts up once scrolled to", async ({ page }) => {
    const target = page.locator("#counter");
    await expectState(target, "ready");
    await expect(target).toHaveText("0");
    await expect(target).toHaveCSS("opacity", "1");

    await scrollTo(target);
    await expect(target).toHaveText("1,200");
  });

  test("parallax moves with the scroll and stays visible", async ({ page }) => {
    const target = page.locator("#parallax");
    const transform = () => target.evaluate((element) => getComputedStyle(element).transform);
    await expectState(target, "ready");

    await scrollTo(target);
    const before = await transform();
    await page.evaluate(() => window.scrollBy(0, 200));
    await expect.poll(transform).not.toBe(before);
    await expect(target).toHaveCSS("opacity", "1");
  });
});
