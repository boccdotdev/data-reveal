import type { Page } from "@playwright/test";
import { expect, initResult, isClipped, opacities, revealDone, scrollTo, test } from "./helpers";

// The element's box in its stage, and its opacity.
function looks(page: Page, id: string) {
  return page.locator(`#${id}`).evaluate((element) => {
    const box = element.getBoundingClientRect();
    const stage = (element.closest(".stage") as HTMLElement).getBoundingClientRect();
    return { x: box.x - stage.x, y: box.y - stage.y, opacity: getComputedStyle(element).opacity };
  });
}

// Which instance arms first, and which one is the batch's.
for (const [order, params, batchInstance] of [
  ["the item's instance first", { mode: "manual", types: "split,clip,counter,fade", second: "batch" }, "second"],
  ["batch's instance first", { mode: "manual", types: "batch", second: "split,clip,counter,fade" }, "instance"],
] as const) {
  test(`a split that is also a batch item ends where its CSS puts it when the batch's instance is destroyed (${order})`, async ({
    page,
    fixtureUrl,
  }) => {
    await page.goto(fixtureUrl("shared", { params }));
    expect(await initResult(page)).toBe("resolved");
    const ids = ["once", "kept", "reversed"];
    // The batch hides each one until it reveals it.
    for (const id of ids) await expect(page.locator(`#${id}`)).toHaveCSS("opacity", "0");

    await page.evaluate((which) => window.__reveal[which]?.destroy(), batchInstance);
    for (const id of ids) {
      const [element, twin] = [await looks(page, id), await looks(page, `${id}-twin`)];
      expect(element.opacity, id).toBe(twin.opacity);
      expect(Math.abs(element.y - twin.y), `#${id} y`).toBeLessThanOrEqual(1);
      expect(Math.abs(element.x - twin.x), `#${id} x`).toBeLessThanOrEqual(1);
    }
    // Each split still plays its pieces in.
    for (const id of ids) {
      await scrollTo(page.locator(`#${id}`));
      await expect.poll(() => opacities(page.locator(`#${id}`))).not.toContain("0");
    }
    await revealDone(page.locator("#once"));
  });

  test(`a clip, counter or fade that is also a batch item plays as itself when the batch's instance is destroyed (${order})`, async ({
    page,
    fixtureUrl,
  }) => {
    await page.goto(fixtureUrl("shared", { params }));
    expect(await initResult(page)).toBe("resolved");
    for (const id of ["clipped", "counted", "faded"]) await expect(page.locator(`#${id}`)).toHaveCSS("opacity", "0");

    await page.evaluate((which) => window.__reveal[which]?.destroy(), batchInstance);
    // clip and counter don't show the element, so it's shown now; counter
    // still counts from where it starts. The fade still hides it, to play.
    await expect(page.locator("#clipped")).toHaveCSS("opacity", "1");
    await expect(page.locator("#counted")).toHaveCSS("opacity", "1");
    await expect(page.locator("#counted")).toHaveText("0");
    await expect(page.locator("#faded")).toHaveCSS("opacity", "0");

    for (const id of ["clipped", "counted", "faded"]) {
      await scrollTo(page.locator(`#${id}`));
      await revealDone(page.locator(`#${id}`));
    }
    await expect(page.locator("#counted")).toHaveText("1200");
    await expect(page.locator("#faded")).toHaveCSS("opacity", "1");
    expect(await isClipped(page.locator("#clipped"))).toBe(false);
  });
}
