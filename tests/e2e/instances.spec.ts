import { expect, expectState, initResult, revealDone, scrollTo, test } from "./helpers";

test.describe("two instances on one page", () => {
  test.beforeEach(async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("instances", { params: { mode: "manual", types: "fade", second: "scale" } }));
    expect(await initResult(page)).toBe("resolved");
  });

  test("one instance's destroy() leaves the other's waiting reveals hidden, and they still play", async ({ page }) => {
    await expect(page.locator("#fade")).toHaveCSS("opacity", "0");
    await page.evaluate(() => window.__reveal.instance?.destroy());

    // The first instance's reveal is put back.
    await expect(page.locator("#fade")).toHaveCSS("opacity", "1");
    for (const id of ["scale", "section-scale"]) {
      const scale = page.locator(`#${id}`);
      await expect(scale).toHaveCSS("opacity", "0");
      await expectState(scale, "ready");
      await scrollTo(scale);
      await revealDone(scale);
      await expect(scale).toHaveCSS("opacity", "1");
    }
  });

  test("one instance's destroy(container) does the same for that subtree", async ({ page }) => {
    await page.evaluate(() => window.__reveal.instance?.destroy(document.getElementById("section") as Element));

    await expect(page.locator("#section-fade")).toHaveCSS("opacity", "1");
    const scale = page.locator("#section-scale");
    await expect(scale).toHaveCSS("opacity", "0");
    await expectState(scale, "ready");
    await scrollTo(scale);
    await revealDone(scale);
    await expect(scale).toHaveCSS("opacity", "1");
  });
});
