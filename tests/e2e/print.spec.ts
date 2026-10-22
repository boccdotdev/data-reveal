import type { Page } from "@playwright/test";
import { expect, initResult, revealDone, scrollTo, test } from "./helpers";

// How an element looks: its box in its stage, opacity, filter and clip-path.
function looks(page: Page, id: string) {
  return page.locator(`#${id}`).evaluate((element) => {
    const box = element.getBoundingClientRect();
    const stage = (element.closest(".stage") as HTMLElement).getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      box: [box.x - stage.x, box.y - stage.y, box.width, box.height],
      opacity: style.opacity,
      filter: style.filter,
      clipPath: style.clipPath,
    };
  });
}

async function expectLikeTwin(page: Page, id: string): Promise<void> {
  const [element, twin] = [await looks(page, id), await looks(page, `${id}-twin`)];
  expect({ ...element, box: [] }, id).toEqual({ ...twin, box: [] });
  element.box.forEach((value, i) => expect(Math.abs(value - twin.box[i]), `#${id} box`).toBeLessThanOrEqual(1));
}

// Every type still waiting below the fold, and a reverse one there too.
const waiting = ["fade", "scale", "blur", "clip", "rotate", "slide", "split", "batch-item", "reverse", "reverse-item"];

test.describe("printing", () => {
  test.beforeEach(async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("printing"));
    expect(await initResult(page)).toBe("resolved");
    // The reverse reveal in view has played in.
    await expect(page.locator("#reverse-shown")).not.toHaveAttribute("data-reveal-pending");
  });

  test("before printing, every reveal shows at its end with its own styles, and a counter shows its target", async ({
    page,
  }) => {
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await page.emulateMedia({ media: "print" });

    for (const id of [...waiting, "reverse-shown"]) await expectLikeTwin(page, id);
    const [parallax, twin] = [await looks(page, "parallax"), await looks(page, "parallax-twin")];
    expect([parallax.opacity, parallax.filter, parallax.clipPath]).toEqual([twin.opacity, twin.filter, twin.clipPath]);
    await expect(page.locator("#split *")).toHaveCount(0);
    await expect(page.locator("#counter")).toHaveText("1200");
    // Play-once reveals stay finished.
    await revealDone(page.locator("#fade"));
  });

  test("after printing, a reverse reveal goes back, and still plays in and out as it's scrolled", async ({ page }) => {
    const reverse = page.locator("#reverse");
    const item = page.locator("#reverse-item");
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await expect(reverse).toHaveCSS("opacity", "0.6");
    await expect(item).toHaveCSS("opacity", "0.6");
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await expect(reverse).toHaveCSS("opacity", "0");
    await expect(item).toHaveCSS("opacity", "0");
    // Played out again: the print rules would show the batch item too.
    await expect(item).toHaveAttribute("data-reveal-pending");

    await scrollTo(reverse);
    await expect(reverse).toHaveCSS("opacity", "0.6");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(reverse).toHaveCSS("opacity", "0");
    // Played out again, it prints in full even without beforeprint.
    await page.emulateMedia({ media: "print" });
    await expect(reverse).toHaveCSS("opacity", "1");
  });

  test("printing without beforeprint shows reveals still to play in full, and leaves the rest their own styles", async ({
    page,
  }) => {
    await page.emulateMedia({ media: "print" });

    // split's pieces are what it hides, so those show, and the element keeps its own styles.
    for (const id of waiting.filter((id) => id !== "split")) {
      const element = await looks(page, id);
      expect([element.opacity, element.filter, element.clipPath], id).toEqual(["1", "none", "none"]);
    }
    await expectLikeTwin(page, "split");
    const pieces = await page
      .locator("#split .data-reveal-char")
      .evaluateAll((chars) => chars.map((char) => [getComputedStyle(char).opacity, getComputedStyle(char).transform]));
    expect(pieces.length).toBeGreaterThan(0);
    for (const piece of pieces) expect(piece).toEqual(["1", "none"]);

    await expectLikeTwin(page, "reverse-shown");
    const [parallax, twin] = [await looks(page, "parallax"), await looks(page, "parallax-twin")];
    expect([parallax.opacity, parallax.filter, parallax.clipPath]).toEqual([twin.opacity, twin.filter, twin.clipPath]);
    // A split that is also a batch item, or a child a batch falls back to:
    // the batch hides the whole element. A split that's neither keeps its own.
    expect((await looks(page, "split-item")).opacity).toBe("1");
    expect((await looks(page, "child-split")).opacity).toBe("1");
    await expectLikeTwin(page, "heading-split");
  });

  test("a reveal the site stopped stays as the site left it, and still prints in full", async ({ page }) => {
    await page.evaluate(async () => {
      const { gsap } = await import("gsap");
      gsap.killTweensOf("#fade");
    });
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await expect(page.locator("#fade")).toHaveAttribute("data-reveal-state", "ready");
    await expect(page.locator("#fade")).toHaveCSS("opacity", "0");
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("#fade")).toHaveCSS("opacity", "1");
  });

  test("a reveal destroy() put back prints with its own styles", async ({ page }) => {
    await page.evaluate(() => window.__reveal.instance?.destroy());
    await page.emulateMedia({ media: "print" });
    for (const id of ["fade", "batch-item", "reverse"]) await expectLikeTwin(page, id);
  });
});

test("a split that is also a batch item stays hidden until the batch reveals it, whichever arms first", async ({
  page,
  fixtureUrl,
}) => {
  for (const late of ["split", "batch"]) {
    const faults = { delay: { [late]: 500 } };
    await page.goto(fixtureUrl("printing", { faults }));
    expect(await initResult(page)).toBe("resolved");
    await expect(page.locator("#split-item")).toHaveCSS("opacity", "0");
  }
});
