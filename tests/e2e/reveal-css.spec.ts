import { expect, expectState, instanceReady, test } from "./helpers";

test("hides reveal elements until init() reaches them", async ({ page, fixtureUrl }) => {
  // A long failsafe, so it can't be what shows the elements below.
  await page.goto(fixtureUrl("basic", { params: { init: "0", failsafe: "60s" } }));
  await instanceReady(page);
  await expect(page.locator("#fade")).toHaveCSS("opacity", "0");
  await expect(page.locator("#unknown")).toHaveCSS("opacity", "0");
  // parallax has no hidden starting state, so it's never hidden.
  await expect(page.locator("#parallax")).toHaveCSS("opacity", "1");

  await page.evaluate(() => window.__reveal.instance?.init());
  await expectState(page.locator("#fade"), "ready");
  await expect(page.locator("#fade")).toHaveCSS("opacity", "1");
  await expectState(page.locator("#unknown"), "skipped");
  await expect(page.locator("#unknown")).toHaveCSS("opacity", "1");
});

test("the failsafe shows content when init() never runs", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("basic", { params: { init: "0", failsafe: "300ms" } }));
  await expect(page.locator("#fade")).toHaveCSS("opacity", "1");
  await expectState(page.locator("#fade"), null);
});

for (const value of ["0", "1sec"]) {
  test(`a failsafe value of "${value}" shows content straight away`, async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("basic", { params: { init: "0", failsafe: value } }));
    await expect(page.locator("#fade")).toHaveCSS("opacity", "1", { timeout: 1_000 });
  });
}

test("print shows content init() hasn't reached", async ({ page, fixtureUrl }) => {
  await page.emulateMedia({ media: "print" });
  // A long failsafe, so only the screen gate can explain a visible element.
  await page.goto(fixtureUrl("basic", { params: { init: "0", failsafe: "60s" } }));
  await instanceReady(page);
  await expect(page.locator("#fade")).toHaveCSS("opacity", "1");
});
