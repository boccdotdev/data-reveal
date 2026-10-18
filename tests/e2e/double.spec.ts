import type { Page } from "@playwright/test";
import { expect, frames, initResult, jumpAtFinish, leftovers, nothingLeft, revealDone, sampleReveal, scrollTo, test } from "./helpers";

// Which type arms first: batch, as the outer element, unless its chunk is late.
for (const [order, faults] of [
  ["batch first", {}],
  ["fade first", { delay: { batch: 500 } }],
] as const) {
  test(`two reveals on one element leave it where its CSS puts it (${order})`, async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("double", { faults }));
    expect(await initResult(page)).toBe("resolved");
    const both = page.locator("#both");

    await scrollTo(page.locator("#list"));
    await expect(both).toHaveCSS("opacity", "1");
    await expect.poll(() => both.evaluate((element) => element.style.transform)).toBe("");
    expect(await leftovers(both)).toEqual(nothingLeft);

    await page.evaluate(() => window.__reveal.instance?.destroy());
    expect(await leftovers(both)).toEqual(nothingLeft);

    await page.evaluate(() => window.__reveal.instance?.init());
    await expect.poll(() => both.evaluate((element) => element.style.transform)).toBe("");
    expect(await leftovers(both)).toEqual(nothingLeft);
  });
}

for (const [order, faults] of [
  ["batch first", {}],
  ["fade first", { delay: { batch: 500 } }],
] as const) {
  test(`two reveals on one element finish without a jump (${order})`, async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("double", { faults }));
    expect(await initResult(page)).toBe("resolved");

    expect(jumpAtFinish(await sampleReveal(page, "both"))).toBeLessThanOrEqual(1);
  });
}

// Records the element's opacity each frame, and its inline styles at the
// moment it was marked done. It scrolls the element's top to each of `stops`
// (fractions of the viewport's height) in turn, 15 frames apart, so triggers
// with different starts fire in order, then samples until it's done and ten
// more frames have passed.
function sampleUntilDone(page: Page, id: string, stops = [0.5]) {
  return page.evaluate(
    ({ id, stops }) =>
      new Promise<{ opacities: number[]; atDone: string[] }>((resolve) => {
        const element = document.getElementById(id) as HTMLElement;
        const opacities: number[] = [];
        let atDone: string[] = [];
        new MutationObserver(() => {
          if (element.getAttribute("data-reveal-state") === "done") {
            atDone = [element.style.opacity, element.style.transform, element.style.translate];
          }
        }).observe(element, { attributes: true, attributeFilter: ["data-reveal-state"] });
        const scrollTo = (stop: number) =>
          window.scrollBy(0, element.getBoundingClientRect().top - stop * window.innerHeight);
        let after = 0;
        const sample = () => {
          opacities.push(Number(getComputedStyle(element).opacity));
          const next = opacities.length / 15;
          if (Number.isInteger(next) && next < stops.length) scrollTo(stops[next]);
          if (element.getAttribute("data-reveal-state") === "done" && opacities.length >= 15 * stops.length) after++;
          if (after >= 10 || opacities.length > 600) resolve({ opacities, atDone });
          else requestAnimationFrame(sample);
        };
        scrollTo(stops[0]);
        requestAnimationFrame(sample);
      }),
    { id, stops },
  );
}

for (const [order, faults] of [
  ["batch first", {}],
  ["fade first", { delay: { batch: 500 } }],
] as const) {
  test.describe(`two reveals on one element (${order})`, () => {
    test.beforeEach(async ({ page, fixtureUrl }) => {
      await page.goto(fixtureUrl("double", { faults }));
      expect(await initResult(page)).toBe("resolved");
    });

    test("both finish, and the element is marked done only once its styles are handed back", async ({ page }) => {
      const { atDone } = await sampleUntilDone(page, "both");
      expect(atDone).toEqual(["", "", ""]);
      await revealDone(page.locator("#list"), 10_000);
      expect(await leftovers(page.locator("#both"))).toEqual(nothingLeft);
    });

    test("one animates the element at a time, so it never dips on the way in", async ({ page }) => {
      const { opacities } = await sampleUntilDone(page, "late");
      const dips = opacities.filter((opacity, i) => i > 0 && opacity < opacities[i - 1] - 0.02);
      expect(dips).toEqual([]);
      expect(opacities[opacities.length - 1]).toBe(1);
    });

    test("a reveal waiting on the element still finishes when the site stops the first one partway", async ({ page }) => {
      const killed = page.locator("#killed");
      await killed.evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - window.innerHeight * 0.95));
      // The fade has started; then the batch reaches the item and leaves it to the fade.
      await expect.poll(() => killed.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0);
      await killed.evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - window.innerHeight * 0.5));
      // Long enough for the batch to have started on the item and left it to
      // the fade. Killed before it starts, the batch's own tween would go too.
      for (let i = 0; i < 4; i++) await frames(page);
      await page.evaluate(async () => {
        const { gsap } = await import("gsap");
        gsap.killTweensOf("#killed");
      });
      await revealDone(page.locator("#list"), 10_000);
    });

    for (const [id, first] of [
      ["muted", "the fade"],
      ["muted-later", "the batch"],
    ]) {
      test(`an element with its own opacity never goes past it, and ends there, when ${first} starts first (#55)`, async ({
        page,
      }) => {
        // Past the fade's or the batch's start, then the other's.
        const { opacities } = await sampleUntilDone(page, id, [0.95, 0.6, 0.2]);
        expect(Math.max(...opacities)).toBeLessThanOrEqual(0.6);
        expect(opacities[opacities.length - 1]).toBe(0.6);
      });
    }
  });
}
