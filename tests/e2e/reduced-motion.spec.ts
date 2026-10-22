import {
  allTypes,
  documentTop,
  expect,
  expectState,
  frames,
  initResult,
  instanceReady,
  isClipped,
  leftovers,
  nothingLeft,
  scrollTo,
  test,
} from "./helpers";

test.use({ reducedMotion: "reduce" });

test("every type snaps to its end state without scrolling", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("types"));
  expect(await initResult(page)).toBe("resolved");

  for (const type of allTypes) {
    const target = page.locator(`#${type}`);
    // Already at its end, so done, except parallax, which never finishes.
    await expectState(target, type === "parallax" ? "ready" : "done");
    await expect(target).toHaveCSS("opacity", "1");
  }
  await expect(page.locator("#counter")).toHaveText("1,200");
  await expect(page.locator("#batch [data-reveal-item]").first()).toHaveCSS("opacity", "1");
  expect(await isClipped(page.locator("#clip"))).toBe(false);
  // No split.
  await expect(page.locator("#split *")).toHaveCount(0);
});

test("leaves no transform, clip-path or filter behind", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("types"));
  expect(await initResult(page)).toBe("resolved");

  for (const type of allTypes) {
    expect(await leftovers(page.locator(`#${type}`))).toEqual(nothingLeft);
  }
});

test("parallax doesn't move", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("types"));
  expect(await initResult(page)).toBe("resolved");
  const target = page.locator("#parallax");

  await scrollTo(target);
  await frames(page);
  const before = await documentTop(target);
  await page.evaluate(() => window.scrollBy(0, 200));
  await frames(page);
  // Within a pixel: some browsers round differently from one frame to the next.
  expect(await documentTop(target)).toBeCloseTo(before, 0);
});

test("reveal.css hides nothing", async ({ page, fixtureUrl }) => {
  // A long failsafe, so only the motion gate can explain a visible element.
  await page.goto(fixtureUrl("basic", { params: { init: "0", failsafe: "60s" } }));
  await instanceReady(page);
  await expect(page.locator("#fade")).toHaveCSS("opacity", "1");
});
