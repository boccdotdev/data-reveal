import { expect, test } from "@playwright/test";
import { expectState, fixture, initResult } from "./helpers";

test("a failed chunk leaves its element visible while other types animate", async ({ page }) => {
  await page.goto(fixture("basic", { faults: { fail: ["fade"] } }));
  expect(await initResult(page)).toMatch(/^rejected: /);

  await expectState(page.locator("#fade"), "failed");
  await expect(page.locator("#fade")).toHaveCSS("opacity", "1");
  await expectState(page.locator("#scale"), "ready");
  await expect(page.locator("#scale")).toHaveCSS("opacity", "1");
  await expectState(page.locator("#split"), "ready");
});

test("a slow chunk doesn't hold back other types", async ({ page }) => {
  await page.goto(fixture("basic", { faults: { delay: { split: 2_000 } } }));

  await expectState(page.locator("#fade"), "ready");
  await expect(page.locator("#fade")).toHaveCSS("opacity", "1");
  await expectState(page.locator("#split"), null);
  expect(await page.evaluate(() => window.__reveal.settled)).toBe(false);

  await expectState(page.locator("#split"), "ready");
  expect(await initResult(page)).toBe("resolved");
});

test("manual mode skips a type that isn't registered, and shows it", async ({ page }) => {
  await page.goto(fixture("basic", { params: { mode: "manual", types: "fade" } }));
  expect(await initResult(page)).toBe("resolved");

  await expectState(page.locator("#fade"), "ready");
  await expectState(page.locator("#scale"), "skipped");
  await expect(page.locator("#scale")).toHaveCSS("opacity", "1");
});
