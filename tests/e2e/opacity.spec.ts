import { allTypes, expect, expectArmed, expectState, initResult, scrollTo, test } from "./helpers";

test("types that don't animate their own opacity keep the element's", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("opacity"));
  expect(await initResult(page)).toBe("resolved");

  for (const id of ["counter", "parallax", "clip", "split", "batch"]) {
    const target = page.locator(`#${id}`);
    await expectArmed(target);
    await expect(target).toHaveCSS("opacity", "0.6");
  }
});

test("a transition on opacity doesn't fool the check", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("opacity"));
  expect(await initResult(page)).toBe("resolved");

  // reveal.css lets go and the element transitions from 0 to its own 0.6.
  const target = page.locator("#counter-transition");
  await expect(target).toHaveCSS("opacity", "0.6");
  expect(await target.evaluate((element) => element.style.opacity)).toBe("");
});

test("a site's own opacity animation is left to finish", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("opacity"));
  expect(await initResult(page)).toBe("resolved");

  // reveal.css lets go and the site's animation runs from 0 to its own 0.6.
  const target = page.locator("#counter-animated");
  await expect(target).toHaveCSS("opacity", "0.6");
  expect(await target.evaluate((element) => element.style.opacity)).toBe("");
});

test("failed and skipped elements show under a site's own pre-hide", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("opacity", { faults: { fail: ["blur"] }, params: { prehide: "site" } }));
  expect(await initResult(page)).toMatch(/^rejected: /);

  await expectState(page.locator("#failed"), "failed");
  await expect(page.locator("#failed")).toHaveCSS("opacity", "1");
  await expectState(page.locator("#skipped"), "skipped");
  await expect(page.locator("#skipped")).toHaveCSS("opacity", "1");
  await expect(page.locator("#skipped-transition")).toHaveCSS("opacity", "1");
  // An inline pre-hide is the site's, not a reveal's, so it's lifted too.
  await expect(page.locator("#inline-hidden")).toHaveCSS("opacity", "1");
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test.describe(`with reducedMotion: ${reducedMotion}`, () => {
    test.use({ reducedMotion });

    test("every type ends visible under a site's own pre-hide", async ({ page, fixtureUrl }) => {
      await page.goto(fixtureUrl("types", { params: { prehide: "site" } }));
      expect(await initResult(page)).toBe("resolved");

      for (const type of allTypes) {
        const target = page.locator(`#${type}`);
        await scrollTo(target);
        await expect(target).toHaveCSS("opacity", "1");
      }
    });
  });
}
