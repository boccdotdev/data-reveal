import { expect, initResult, jumpAtFinish, leftovers, nothingLeft, sampleReveal, scrollTo, test } from "./helpers";

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
