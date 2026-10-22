import { expect, initResult, test } from "./helpers";

test("defaults and typeDefaults set durations, and an attribute beats both", async ({ page, fixtureUrl }) => {
  // Linear and long, so the default-duration fade is plainly mid-way when the others finish.
  const options = { defaults: { duration: 30, ease: "none" }, typeDefaults: { scale: { duration: 0.4 } } };
  await page.goto(fixtureUrl("defaults", { params: { options: JSON.stringify(options) } }));
  expect(await initResult(page)).toBe("resolved");

  await expect(page.locator("#fade-attribute")).toHaveCSS("opacity", "1");
  await expect(page.locator("#scale")).toHaveCSS("opacity", "1");
  const fade = Number(await page.locator("#fade").evaluate((element) => getComputedStyle(element).opacity));
  expect(fade).toBeGreaterThan(0);
  expect(fade).toBeLessThan(0.5);
});
