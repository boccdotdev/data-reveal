import { expect, test } from "@playwright/test";
import { expectState, fixture, initResult } from "./helpers";

test("types that don't animate their own opacity keep the element's", async ({ page }) => {
  await page.goto(fixture("opacity"));
  expect(await initResult(page)).toBe("resolved");

  for (const id of ["counter", "parallax", "clip", "split", "batch"]) {
    const target = page.locator(`#${id}`);
    await expectState(target, "ready");
    await expect(target).toHaveCSS("opacity", "0.6");
  }
});

test("a transition on opacity doesn't fool the check", async ({ page }) => {
  await page.goto(fixture("opacity"));
  expect(await initResult(page)).toBe("resolved");

  // reveal.css lets go and the element transitions from 0 to its own 0.6.
  const target = page.locator("#counter-transition");
  await expect(target).toHaveCSS("opacity", "0.6");
  expect(await target.evaluate((element) => element.style.opacity)).toBe("");
});

test("failed and skipped elements show under a site's own pre-hide", async ({ page }) => {
  await page.goto(fixture("opacity", { faults: { fail: ["blur"] }, params: { prehide: "site" } }));
  expect(await initResult(page)).toMatch(/^rejected: /);

  await expectState(page.locator("#failed"), "failed");
  await expect(page.locator("#failed")).toHaveCSS("opacity", "1");
  await expectState(page.locator("#skipped"), "skipped");
  await expect(page.locator("#skipped")).toHaveCSS("opacity", "1");
  await expect(page.locator("#skipped-transition")).toHaveCSS("opacity", "1");
});
