import { expect, initResult, revealDone, scrollTo, test } from "./helpers";

test("two copies of the package with the same type arm each element once", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("copies", { params: { mode: "manual", types: "fade", second: "fade", copy: "1" } }));
  expect(await initResult(page)).toBe("resolved");

  // One reveal's worth of triggers on the element still waiting.
  const triggers = await page.evaluate(async () => {
    const { ScrollTrigger } = await import("gsap/ScrollTrigger");
    return ScrollTrigger.getAll().filter((trigger) => trigger.trigger === document.getElementById("below")).length;
  });
  expect(triggers).toBe(1);

  // Where the element sits in its stage, and how opaque it is.
  const settled = (id: string) =>
    page.locator(`#${id}`).evaluate((element) => {
      const box = element.getBoundingClientRect();
      const stage = (element.parentElement as HTMLElement).getBoundingClientRect();
      return { x: box.x - stage.x, y: box.y - stage.y, opacity: getComputedStyle(element).opacity };
    });
  for (const id of ["top", "below"]) {
    const target = page.locator(`#${id}`);
    await scrollTo(target);
    await revealDone(target);
    await expect.poll(() => settled(id)).toEqual(await settled(`${id}-twin`));
  }
});
