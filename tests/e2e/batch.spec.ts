import { expect, initResult, leftovers, nothingLeft, test } from "./helpers";

test("destroy() mid-reveal, then init() again, leaves every batch item where its CSS puts it", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("batch"));
  expect(await initResult(page)).toBe("resolved");
  const items = page.locator("#list li");
  const opacityOf = (index: number) => items.nth(index).evaluate((item) => Number(getComputedStyle(item).opacity));

  // The first group is partway through its four-second reveal when the second
  // group enters.
  await expect.poll(() => opacityOf(0)).toBeGreaterThan(0);
  await page.evaluate(() => window.scrollBy(0, 200));
  await expect.poll(() => opacityOf(2)).toBeGreaterThan(0);
  expect(await opacityOf(0)).toBeLessThan(1);

  // As a filter or sort UI would.
  await page.evaluate(async () => {
    window.__reveal.instance?.destroy();
    await new Promise((resolve) => setTimeout(resolve, 60));
    await window.__reveal.instance?.init();
  });

  // Where each item sits in its list, and how opaque it is.
  const settled = (list: string) =>
    page.locator(list).evaluate((ul) =>
      Array.from(ul.children, (item) => ({
        top: item.getBoundingClientRect().top - ul.getBoundingClientRect().top,
        opacity: getComputedStyle(item).opacity,
      })),
    );
  for (let index = 0; index < 4; index++) {
    await expect.poll(() => items.nth(index).evaluate((item) => item.style.opacity), { timeout: 10_000 }).toBe("");
    expect(await leftovers(items.nth(index))).toEqual(nothingLeft);
  }
  expect(await settled("#list")).toEqual(await settled("#twin"));
});
