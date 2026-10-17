import { expect, initResult, test } from "./helpers";

test("content too near the end to reach the default start reveals at the bottom", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("bottom"));
  expect(await initResult(page)).toBe("resolved");
  await expect(page.locator("#fade")).toHaveCSS("opacity", "0");

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator("#fade")).toHaveCSS("opacity", "1");
  await expect(page.locator("#batch [data-reveal-item]")).toHaveCSS("opacity", "1");
  // A start set on the element is used exactly as given, so this one can't be reached.
  await expect(page.locator("#explicit")).toHaveCSS("opacity", "0");
});

test("on a page too short to scroll, content low in the viewport reveals at load", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("short"));
  expect(await initResult(page)).toBe("resolved");
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);

  await expect(page.locator("#fade")).toHaveCSS("opacity", "1");
  await expect(page.locator("#batch [data-reveal-item]")).toHaveCSS("opacity", "1");
});

test("inside an offset scroller, content in view at load reveals without scrolling", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("scroller", { params: { scroller: "#scroller" } }));
  expect(await initResult(page)).toBe("resolved");

  await expect(page.locator("#fade")).toHaveCSS("opacity", "1");
  expect(await page.locator("#scroller").evaluate((element) => element.scrollTop)).toBe(0);
});
