import { expect, test } from "@playwright/test";
import { clipInsets, expectState, fixture, initResult } from "./helpers";

test.use({ reducedMotion: "reduce" });

test("every type snaps to its end state without scrolling", async ({ page }) => {
  await page.goto(fixture("types"));
  expect(await initResult(page)).toBe("resolved");

  for (const type of ["fade", "scale", "blur", "rotate", "slide", "counter", "parallax", "clip", "split", "batch"]) {
    const target = page.locator(`#${type}`);
    await expectState(target, "ready");
    await expect(target).toHaveCSS("opacity", "1");
  }
  await expect(page.locator("#counter")).toHaveText("1,200");
  await expect(page.locator("#batch [data-reveal-item]").first()).toHaveCSS("opacity", "1");
  expect(await clipInsets(page.locator("#clip"))).toEqual([0]);
  // No split and no parallax movement.
  await expect(page.locator("#split *")).toHaveCount(0);
  await expect(page.locator("#parallax")).toHaveCSS("transform", "none");
});

test("reveal.css hides nothing", async ({ page }) => {
  await page.goto(fixture("basic", { params: { init: "0" } }));
  await page.waitForFunction(() => window.__reveal?.instance !== null);
  await expect(page.locator("#fade")).toHaveCSS("opacity", "1");
});
