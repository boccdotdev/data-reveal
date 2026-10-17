import { expect, initResult, revealDone, test } from "./helpers";

test("printing shows every reveal at its end, waiting or partway through", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("partway"));
  expect(await initResult(page)).toBe("resolved");
  await revealDone(page.locator("#done"));
  // Partway through.
  await expect
    .poll(() => page.locator("#fade-now").evaluate((element) => Number(getComputedStyle(element).opacity)))
    .toBeGreaterThan(0);

  await page.emulateMedia({ media: "print" });
  const hidden = await page.evaluate(() => {
    const found: string[] = [];
    for (const reveal of document.querySelectorAll<HTMLElement>("[data-reveal]:not(#done)")) {
      for (const element of [reveal, ...reveal.querySelectorAll<HTMLElement>("*")]) {
        // split's visually hidden copies of its words stay hidden.
        if (element.style.clipPath === "inset(50%)") continue;
        const style = getComputedStyle(element);
        const left = [style.opacity, style.transform, style.translate, style.rotate, style.scale, style.clipPath, style.filter];
        if (left.join() !== "1,none,none,none,none,none,none") found.push(`#${reveal.id} ${element.tagName}: ${left.join(" | ")}`);
      }
    }
    return found;
  });
  expect(hidden).toEqual([]);

  // A finished reveal prints as its own CSS has it, and so does everything else.
  expect(await page.locator("#done").evaluate((element) => getComputedStyle(element).translate)).toBe("0px -10px");
  expect(await page.locator("#unrelated").evaluate((element) => getComputedStyle(element).transform)).not.toBe("none");
});
