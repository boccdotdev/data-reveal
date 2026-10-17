import {
  allTypes,
  expect,
  expectState,
  initResult,
  isClipped,
  leftovers,
  nothingLeft,
  opacities,
  revealDone,
  scrollTo,
  test,
} from "./helpers";

test.describe("a finished play-once reveal", () => {
  for (const type of ["fade", "scale", "blur", "rotate", "slide", "clip"]) {
    test(`${type} leaves no transform, clip-path or filter behind`, async ({ page, fixtureUrl }) => {
      await page.goto(fixtureUrl("types"));
      expect(await initResult(page)).toBe("resolved");
      const target = page.locator(`#${type}`);

      await scrollTo(target);
      await expect(target).toHaveCSS("opacity", "1");
      await expect.poll(() => leftovers(target)).toEqual(nothingLeft);
    });
  }

  test("batch leaves nothing on its items", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("types"));
    expect(await initResult(page)).toBe("resolved");
    const items = page.locator("#batch [data-reveal-item]");

    await scrollTo(page.locator("#batch"));
    await expect(items.last()).toHaveCSS("opacity", "1");
    await expect.poll(() => leftovers(items.first())).toEqual(nothingLeft);
    await expect.poll(() => leftovers(items.last())).toEqual(nothingLeft);
  });

  test("lets a position: fixed child stay fixed to the viewport", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("finish"));
    expect(await initResult(page)).toBe("resolved");
    const scale = page.locator("#scale");

    await scrollTo(scale);
    await expect.poll(() => leftovers(scale)).toEqual(nothingLeft);
    expect(await page.locator("#fixed").evaluate((element) => element.getBoundingClientRect().top)).toBe(0);
  });

  test("lets a class change its opacity, such as a hover dim", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("finish"));
    expect(await initResult(page)).toBe("resolved");
    const dim = page.locator("#dim");

    await scrollTo(dim);
    await expect.poll(() => dim.evaluate((element) => element.style.opacity)).toBe("");
    await dim.hover();
    await expect(dim).toHaveCSS("opacity", "0.5");
  });

  test("ends at the element's own opacity", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("finish"));
    expect(await initResult(page)).toBe("resolved");
    const muted = page.locator("#muted");

    await scrollTo(muted);
    await expect.poll(() => muted.evaluate((element) => element.style.opacity)).toBe("");
    await expect(muted).toHaveCSS("opacity", "0.6");
  });

  test("keeps its end state with data-reveal-keep or data-reveal-reverse", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("finish"));
    expect(await initResult(page)).toBe("resolved");

    for (const id of ["keep", "reverse"]) {
      const target = page.locator(`#${id}`);
      await scrollTo(target);
      // Its twin finishing means its own reveal has finished too.
      await revealDone(page.locator(`#${id}-twin`));
      expect(await leftovers(page.locator(`#${id}-twin`))).toEqual(nothingLeft);
      expect((await leftovers(target)).transform).not.toBe("none");
      // Done with keep, but not with reverse, which plays again.
      await expectState(target, id === "keep" ? "done" : "ready");
    }
  });
});

test.describe("destroy()", () => {
  test("shows an element that hadn't revealed yet, with nothing left inline", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("types"));
    expect(await initResult(page)).toBe("resolved");
    const fade = page.locator("#fade");
    await expect(fade).toHaveCSS("opacity", "0");

    await page.evaluate(() => window.__reveal.instance?.destroy(document.getElementById("fade") ?? undefined));
    await expect(fade).toHaveCSS("opacity", "1");
    expect(await leftovers(fade)).toEqual(nothingLeft);
    // Still marked as handled, so reveal.css doesn't hide it again.
    await expectState(fade, "ready");
  });

  test("puts every type back", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("types"));
    expect(await initResult(page)).toBe("resolved");

    await page.evaluate(() => window.__reveal.instance?.destroy());
    for (const type of allTypes) {
      const target = page.locator(`#${type}`);
      await expect(target).toHaveCSS("opacity", "1");
      expect(await opacities(target)).not.toContain("0");
      expect(await isClipped(target)).toBe(false);
    }
  });

  test("leaves a counter showing its target, whether it had counted or not", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("finish"));
    expect(await initResult(page)).toBe("resolved");
    const counter = page.locator("#counter-to");

    await page.evaluate(() => window.__reveal.instance?.destroy(document.getElementById("counter-to") ?? undefined));
    await expect(counter).toHaveText("1,200");

    await page.evaluate(() => window.__reveal.instance?.init(document.getElementById("counter-to") ?? undefined));
    await scrollTo(counter);
    await expect(counter).toHaveText("1,200");
    await page.evaluate(() => window.__reveal.instance?.destroy());
    await expect(counter).toHaveText("1,200");
  });

  test("keeps inline styles the site set after init()", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("finish"));
    expect(await initResult(page)).toBe("resolved");
    const styled = page.locator("#styled");

    await styled.evaluate((element) => {
      element.style.outline = "2px solid red";
      element.style.display = "none";
    });
    await page.evaluate(() => window.__reveal.instance?.destroy());
    expect(
      await styled.evaluate((element) => [element.style.outlineStyle, element.style.outlineWidth, element.style.display]),
    ).toEqual(["solid", "2px", "none"]);
    // The reveal's own starting state is gone.
    expect(await styled.evaluate((element) => [element.style.opacity, element.style.transform])).toEqual(["", ""]);
  });

  test("puts a counter's own text back", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("finish"));
    expect(await initResult(page)).toBe("resolved");
    // It counts up from 0 to the number it showed, once scrolled to.
    await expect(page.locator("#counter")).toHaveText("0");

    await page.evaluate(() => window.__reveal.instance?.destroy());
    await expect(page.locator("#counter")).toHaveText("1,200");
  });

  test("with { revert: false }, leaves the element as the reveal had it", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("types"));
    expect(await initResult(page)).toBe("resolved");

    await page.evaluate(() => window.__reveal.instance?.destroy({ revert: false }));
    await expect(page.locator("#fade")).toHaveCSS("opacity", "0");
  });
});

test("destroy() during a reveal, as a page transition would, shows every type with nothing left inline", async ({
  page,
  fixtureUrl,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(fixtureUrl("partway"));
  expect(await initResult(page)).toBe("resolved");
  await expect
    .poll(() => page.locator("#fade-now").evaluate((element) => Number(getComputedStyle(element).opacity)))
    .toBeGreaterThan(0);

  await page.evaluate(() => window.__reveal.instance?.destroy());
  for (const type of ["fade", "scale", "split", "batch", "blur", "clip", "rotate", "slide", "counter"]) {
    const target = page.locator(`#${type}-now`);
    expect(await opacities(target), type).not.toContain("0");
    expect(await leftovers(target), type).toEqual(nothingLeft);
    // Nothing inline on it or anything inside it, and split's own HTML is back.
    expect(await target.evaluate((element) => [element, ...element.querySelectorAll("*")].filter((node) => node.hasAttribute("style")).length), type).toBe(0);
  }
  await expect(page.locator("#split-now")).toHaveText("Split heading");
  await expect(page.locator("#split-now *")).toHaveCount(0);
  await expect(page.locator("#counter-now")).toHaveText("1200");
  expect(errors).toEqual([]);
});
