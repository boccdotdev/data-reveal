import { expect, initResult, test } from "./helpers";
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
    return { split: Array.from(split.children).filter((child) => child.tagName === "DIV").length, twin: tops.size };
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
    await page.locator("#late > div").first().evaluate((line) => line.setAttribute("data-before-font", ""));
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

    await expect(once.locator("div")).toHaveCount(0);
    expect(await once.evaluate((element) => element.innerHTML)).toBe(
      await page.locator("#lines-twin").evaluate((element) => element.innerHTML),
    );
  });
});
