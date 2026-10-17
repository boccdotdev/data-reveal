import { expect, finishedAt, initResult, instanceReady, revealDone, sampleReveal, scrollTo, test, twinBox } from "./helpers";

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

test("an element one copy armed and destroyed reveals from where its CSS puts it when the other copy arms it", async ({
  page,
  fixtureUrl,
}) => {
  await page.goto(
    fixtureUrl("copies", { params: { mode: "manual", types: "fade", second: "fade", copy: "1", init: "0" } }),
  );
  // The harness creates the second instance first.
  await instanceReady(page);
  // The second copy arms the waiting fade, lets go of it, and the first takes it on.
  await page.evaluate(async () => {
    await window.__reveal.second?.init();
    window.__reveal.second?.destroy();
    await window.__reveal.instance?.init();
  });

  const samples = await sampleReveal(page, "plain");
  const handed = finishedAt(samples);
  expect(handed).toBeGreaterThan(0);
  const [before, at] = [samples[handed - 1], samples[handed]];
  expect(Math.abs(at.y - before.y), "jumped when the reveal finished").toBeLessThanOrEqual(1);
  expect(Math.abs(samples[samples.length - 1].y - (await twinBox(page, "plain")).y)).toBeLessThanOrEqual(1);
});
