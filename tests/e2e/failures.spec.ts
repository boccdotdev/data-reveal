import { expect, expectArmed, expectState, initResult, test } from "./helpers";

test("a failed chunk leaves its element visible while other types animate", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("basic", { faults: { fail: ["fade"] } }));
  expect(await initResult(page)).toMatch(/^rejected: /);

  await expectState(page.locator("#fade"), "failed");
  await expect(page.locator("#fade")).toHaveCSS("opacity", "1");
  await expectArmed(page.locator("#scale"));
  await expect(page.locator("#scale")).toHaveCSS("opacity", "1");
  await expectArmed(page.locator("#split"));
});

test("a slow chunk doesn't hold back other types", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("basic", { faults: { delay: { split: 5_000 } } }));

  await expectArmed(page.locator("#fade"));
  await expect(page.locator("#fade")).toHaveCSS("opacity", "1");
  await expectState(page.locator("#split"), null);
  expect(await page.evaluate(() => window.__reveal.settled)).toBe(false);

  await expectArmed(page.locator("#split"), 10_000);
  expect(await initResult(page)).toBe("resolved");
});

test("manual mode skips a type that isn't registered, and shows it", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("basic", { params: { mode: "manual", types: "fade" } }));
  expect(await initResult(page)).toBe("resolved");

  await expectArmed(page.locator("#fade"));
  await expectState(page.locator("#scale"), "skipped");
  await expect(page.locator("#scale")).toHaveCSS("opacity", "1");
});

test("if the package itself fails to load, the failsafe shows content", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("basic", { faults: { fail: ["index"] }, params: { failsafe: "300ms" } }));
  expect(await initResult(page)).toMatch(/^failed to load: /);

  await expectState(page.locator("#fade"), null);
  await expect(page.locator("#fade")).toHaveCSS("opacity", "1");
});
