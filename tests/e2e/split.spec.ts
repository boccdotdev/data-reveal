import { expect, initResult, revealDone, test } from "./helpers";
import type { Page } from "@playwright/test";

// Lines in the split element, and lines the same text takes in its unsplit
// twin, counted from where the browser actually broke it.
function lineCounts(page: Page, id: string): Promise<{ split: number; twin: number }> {
  return page.evaluate((id) => {
    const split = document.getElementById(id) as HTMLElement;
    const twin = document.getElementById(`${id}-twin`) as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(twin);
    const tops = new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top)));
    return { split: split.querySelectorAll(".data-reveal-line").length, twin: tops.size };
  }, id);
}

test.describe("split lines", () => {
  test("re-split to the new width when the viewport changes", async ({ page, fixtureUrl, engine }) => {
    await page.goto(fixtureUrl("split"));
    expect(await initResult(page)).toBe("resolved");
    const before = await lineCounts(page, "lines");
    expect(before.split).toBe(before.twin);
    // Triggers for a split still waiting below the fold.
    const triggers = () =>
      page.evaluate(async () => {
        const { ScrollTrigger } = await import("gsap/ScrollTrigger");
        return ScrollTrigger.getAll().filter((trigger) => trigger.trigger === document.getElementById("below")).length;
      });
    if (engine === "gsap") expect(await triggers()).toBe(1);

    await page.setViewportSize({ width: 600, height: 720 });
    await expect.poll(async () => (await lineCounts(page, "lines")).twin).toBeGreaterThan(before.twin);
    await expect.poll(async () => {
      const { split, twin } = await lineCounts(page, "lines");
      return split - twin;
    }).toBe(0);
    await expect.poll(async () => {
      const { split, twin } = await lineCounts(page, "below");
      return split - twin;
    }).toBe(0);
    // Each re-split replaces its trigger rather than adding one.
    if (engine === "gsap") expect(await triggers()).toBe(1);
  });

  test("re-split once a late font finishes loading", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("split", { faults: { delay: { late: 1500 } } }));
    expect(await initResult(page)).toBe("resolved");
    // Mark the lines split so far, then switch to the font, which arrives late.
    await page.locator("#late .data-reveal-line").first().evaluate((line) => line.setAttribute("data-before-font", ""));
    await page.evaluate(() => {
      for (const id of ["late", "late-twin"]) document.getElementById(id)?.classList.add("late");
    });

    await page.waitForFunction(() => document.fonts.check("16px Late"));
    await expect(page.locator("#late [data-before-font]")).toHaveCount(0);
    const { split, twin } = await lineCounts(page, "late");
    expect(split).toBe(twin);
  });

  test("an element split before it was in the page re-splits to its width once inserted", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("split"));
    expect(await initResult(page)).toBe("resolved");

    await page.evaluate(async () => {
      const text = document.getElementById("lines-twin")?.textContent ?? "";
      const card = document.createElement("p");
      card.id = "card";
      card.textContent = text;
      Object.assign(card.dataset, { reveal: "split", revealSplit: "lines", revealKeep: "", revealDuration: "0.2" });
      const twin = document.createElement("p");
      twin.id = "card-twin";
      twin.className = "twin";
      twin.textContent = text;
      await window.__reveal.instance?.init(card);
      document.querySelector(".column")?.append(card, twin);
    });
    await expect.poll(async () => {
      const { split, twin } = await lineCounts(page, "card");
      return split - twin;
    }).toBe(0);
  });

  test("a play-once split puts the element's own HTML back when it finishes", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("split"));
    expect(await initResult(page)).toBe("resolved");
    const once = page.locator("#once");

    await revealDone(once);
    await expect(once.locator("*")).toHaveCount(0);
    expect(await once.evaluate((element) => element.innerHTML)).toBe(
      await page.locator("#lines-twin").evaluate((element) => element.innerHTML),
    );
  });
});

test.describe("split pieces", () => {
  // Where each character sits relative to the element, read from the text
  // itself, so it works the same on the split element and its twin.
  function characters(page: Page, id: string): Promise<Array<[number, number]>> {
    return page.locator(`#${id}`).evaluate((element) => {
      const origin = element.getBoundingClientRect();
      const range = document.createRange();
      const found: Array<[number, number]> = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? "";
        for (let i = 0; i < text.length; i++) {
          if (/\s/.test(text[i])) continue;
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const box = range.getBoundingClientRect();
          found.push([box.left - origin.left, box.top - origin.top]);
        }
      }
      return found;
    });
  }

  test("lay out like SplitText's own <div> pieces, and words and lines like the unsplit text", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("split"));
    expect(await initResult(page)).toBe("resolved");

    // The same text split with SplitText's defaults, which wrap each piece in a <div>.
    await page.evaluate(async () => {
      const { SplitText } = await import("gsap/SplitText");
      for (const [id, type] of [["chars", "words, chars"], ["words", "words"], ["lines", "lines"]]) {
        const twin = document.getElementById(`${id}-twin`) as HTMLElement;
        const copy = twin.cloneNode(true) as HTMLElement;
        copy.id = `${id}-divs`;
        twin.after(copy);
        SplitText.create(copy, { type, aria: "none" });
      }
    });
    const furthest = (a: Array<[number, number]>, b: Array<[number, number]>) =>
      Math.max(...a.map(([x, y], i) => Math.max(Math.abs(x - b[i][0]), Math.abs(y - b[i][1]))));

    for (const id of ["chars", "words", "lines"]) {
      await revealDone(page.locator(`#${id}`));
      const split = await characters(page, id);
      const divs = await characters(page, `${id}-divs`);
      expect(split.length).toBe(divs.length);
      expect(furthest(split, divs), `#${id} differs from SplitText's own pieces`).toBeLessThanOrEqual(1);
      // Characters split apart lose their kerning, so only words and lines
      // match the unsplit text, give or take kerning across a space.
      if (id !== "chars") expect(furthest(split, await characters(page, `${id}-twin`)), `#${id} moved`).toBeLessThanOrEqual(1.5);
    }
    const { split, twin } = await lineCounts(page, "lines");
    expect(split).toBe(twin);
    // A transform, which is what moves them, doesn't apply to inline boxes.
    const inline = await page
      .locator(".data-reveal-char, .data-reveal-word, .data-reveal-line")
      .evaluateAll((pieces) => pieces.filter((piece) => getComputedStyle(piece).display === "inline").length);
    expect(inline).toBe(0);
  });
});
