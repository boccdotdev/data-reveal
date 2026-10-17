import type { Page } from "@playwright/test";
import { expect, initResult, test } from "./helpers";

// The opacity of `id` in the frame the linear reveal first passes 0.4: well
// under it for an ease that starts slowly, well over it for one that starts fast.
function againstLinear(page: Page, id: string): Promise<{ linear: number; other: number }> {
  return page.evaluate(
    (id) =>
      new Promise((resolve) => {
        const linear = document.getElementById("linear") as HTMLElement;
        const other = document.getElementById(id) as HTMLElement;
        const sample = () => {
          const at = Number(getComputedStyle(linear).opacity);
          if (at >= 0.4) resolve({ linear: at, other: Number(getComputedStyle(other).opacity) });
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
    id,
  );
}

test("data-reveal-ease changes the motion", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("ease"));
  expect(await initResult(page)).toBe("resolved");
  const { linear, other } = await againstLinear(page, "eased");
  expect(other).toBeLessThan(linear - 0.2);
});

test("an ease in the defaults changes the motion of a reveal without its own", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("ease", { params: { options: JSON.stringify({ defaults: { ease: "power4.in" } }) } }));
  expect(await initResult(page)).toBe("resolved");
  const { linear, other } = await againstLinear(page, "default");
  expect(other).toBeLessThan(linear - 0.2);
});
