import { expect, finishedAt, initResult, sampleReveal, test, twinBox } from "./helpers";

test.describe("a reveal on an element with a transform of its own", () => {
  test.beforeEach(async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("transforms"));
    expect(await initResult(page)).toBe("resolved");
  });

  for (const [id, css] of [
    ["slide", "transform: translateX(-50%)"],
    ["scale", "scale: 1.2"],
    ["rotate", "rotate: 8deg, turning on z"],
    ["rotate-x", "rotate: 8deg, turning on x"],
    ["fade", "translate: 0 -30px"],
    ["tailwind", "Tailwind's translate-x-10"],
    ["batch-item", "translate: 0 -30px, on a batch item"],
  ]) {
    test(`ends where the CSS puts it, without a jump: ${id} with ${css}`, async ({ page }) => {
      const samples = await sampleReveal(page, id);
      const twin = await twinBox(page, id);
      const last = samples[samples.length - 1];
      // The frame the reveal handed its styles back, and the one before it.
      const handed = finishedAt(samples);
      expect(handed).toBeGreaterThan(0);
      const [before, at] = [samples[handed - 1], samples[handed]];

      for (const key of ["x", "y", "width", "height"] as const) {
        expect(Math.abs(at[key] - before[key]), `${key} jumped when the reveal finished`).toBeLessThanOrEqual(1);
        expect(Math.abs(last[key] - twin[key]), `${key} ended away from the twin`).toBeLessThanOrEqual(1);
      }
    });
  }
});

// The element's box relative to its stage, after the site runs a no-op GSAP
// set on it, as a hover tween would start with.
async function boxAfterSiteTween(page: import("@playwright/test").Page, id: string) {
  return page.evaluate(async (id) => {
    const { gsap } = await import("gsap");
    const element = document.getElementById(id) as HTMLElement;
    gsap.set(element, { x: "+=0" });
    const box = element.getBoundingClientRect();
    const origin = (element.closest(".stage") as HTMLElement).getBoundingClientRect();
    return { x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height };
  }, id);
}

test.describe("the site's own GSAP tween on an element with a transform of its own", () => {
  test.beforeEach(async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("transforms"));
    expect(await initResult(page)).toBe("resolved");
  });

  const cases = [
    ["fade", "translate: 0 -30px"],
    ["tailwind", "Tailwind's translate-x-10"],
    ["scale", "scale: 1.2"],
    ["rotate", "rotate: 8deg"],
  ] as const;

  for (const [id, css] of cases) {
    test(`doesn't move it after the reveal finished: ${id} with ${css}`, async ({ page }) => {
      await sampleReveal(page, id);
      const twin = await twinBox(page, id);
      const box = await boxAfterSiteTween(page, id);
      for (const key of ["x", "y", "width", "height"] as const) {
        expect(Math.abs(box[key] - twin[key]), `${key} moved`).toBeLessThanOrEqual(1);
      }
    });

    test(`doesn't move it after destroy() before its reveal: ${id} with ${css}`, async ({ page }) => {
      // Still below the fold, in its starting state.
      await page.evaluate(() => window.__reveal.instance?.destroy());
      const twin = await twinBox(page, id);
      const box = await boxAfterSiteTween(page, id);
      for (const key of ["x", "y", "width", "height"] as const) {
        expect(Math.abs(box[key] - twin[key]), `${key} moved`).toBeLessThanOrEqual(1);
      }
    });
  }

  test("doesn't move it after destroy(): parallax with translate: 0 -30px", async ({ page }) => {
    await page.locator("#parallax").evaluate((element) => element.scrollIntoView({ block: "center" }));
    // Moved by the scroll, so GSAP has read and folded its transform.
    await expect.poll(() => page.locator("#parallax").evaluate((element) => element.style.transform)).not.toBe("");
    await page.evaluate(() => window.__reveal.instance?.destroy());
    const twin = await twinBox(page, "parallax");
    const box = await boxAfterSiteTween(page, "parallax");
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(box[key] - twin[key]), `${key} moved`).toBeLessThanOrEqual(1);
    }
  });
});
