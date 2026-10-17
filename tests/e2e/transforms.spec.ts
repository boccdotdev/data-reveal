import { expect, initResult, sampleReveal, test, twinBox } from "./helpers";

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
      const handed = samples.findIndex((s, i) => i > 0 && samples[i - 1].inline && !s.inline);
      expect(handed).toBeGreaterThan(0);
      const [before, at] = [samples[handed - 1], samples[handed]];

      for (const key of ["x", "y", "width", "height"] as const) {
        expect(Math.abs(at[key] - before[key]), `${key} jumped when the reveal finished`).toBeLessThanOrEqual(1);
        expect(Math.abs(last[key] - twin[key]), `${key} ended away from the twin`).toBeLessThanOrEqual(1);
      }
    });
  }
});
