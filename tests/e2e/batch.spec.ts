import { documentTop, expect, frames, initResult, leftovers, nothingLeft, revealDone, scrollTo, test } from "./helpers";

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
  // Still revealing: its opacity reaches 1 well before the end, but it isn't done.
  await expect(items.nth(0)).toHaveAttribute("data-reveal-pending");

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

// Appends `count` items to the list and runs init() over it again, as a
// load-more would. Returns the new items' opacity as init() leaves them,
// then every item's opacity each frame until the list is done and ten more
// frames have passed.
function loadMore(page: import("@playwright/test").Page, id: string, count: number) {
  return page.evaluate(
    async ({ id, count }) => {
      const list = document.getElementById(id) as HTMLElement;
      const added = Array.from({ length: count }, (_, i) => {
        const item = document.createElement("li");
        item.setAttribute("data-reveal-item", "");
        item.textContent = `more ${i + 1}`;
        return item;
      });
      list.append(...added);
      await window.__reveal.instance?.init(list);
      const armed = added.map((item) => Number(getComputedStyle(item).opacity));
      const frames: number[][] = [];
      await new Promise<void>((resolve) => {
        let after = 0;
        const sample = () => {
          frames.push(Array.from(list.children, (item) => Number(getComputedStyle(item).opacity)));
          if (list.getAttribute("data-reveal-state") === "done") after++;
          if (after >= 10 || frames.length > 600) resolve();
          else requestAnimationFrame(sample);
        };
        sample();
      });
      return { armed, frames };
    },
    { id, count },
  );
}

test.describe("a batch that gets more items", () => {
  test.beforeEach(async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("loadmore"));
    expect(await initResult(page)).toBe("resolved");
  });

  test("reveals only the new items, staggered as a group, and leaves the shown ones as they are", async ({ page }) => {
    await revealDone(page.locator("#grid"));
    const { armed, frames: samples } = await loadMore(page, "grid", 6);

    // The first six never move from where they ended.
    for (const frame of samples) expect(frame.slice(0, 6)).toEqual([1, 1, 1, 1, 1, 1]);
    // The new six start hidden, end shown, and start one after another.
    expect(armed).toEqual([0, 0, 0, 0, 0, 0]);
    expect(samples[samples.length - 1].slice(6)).toEqual([1, 1, 1, 1, 1, 1]);
    const starts = [6, 7, 8, 9, 10, 11].map((index) => samples.findIndex((frame) => frame[index] > 0.05));
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(starts[5] - starts[0]).toBeGreaterThan(3);
  });

  test("takes on new items while its first ones are still revealing", async ({ page }) => {
    const first = page.locator("#slow li").first();
    await expect.poll(() => first.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0);
    const { armed, frames: samples } = await loadMore(page, "slow", 3);

    // The first three carry on rising, and the new ones reveal from hidden.
    expect(armed).toEqual([0, 0, 0]);
    for (let i = 1; i < samples.length; i++) {
      samples[i].slice(0, 3).forEach((opacity, item) => expect(opacity).toBeGreaterThanOrEqual(samples[i - 1][item] - 0.01));
    }
    expect(samples[samples.length - 1]).toEqual([1, 1, 1, 1, 1, 1]);
  });
});

// Gives the element a 30px box, then records its opacity for 30 frames.
function growAndSample(page: import("@playwright/test").Page, id: string): Promise<number[]> {
  return page.evaluate(
    (id) =>
      new Promise<number[]>((resolve) => {
        const element = document.getElementById(id) as HTMLElement;
        element.style.height = "30px";
        element.textContent = "has a box now";
        const seen: number[] = [];
        const sample = () => {
          seen.push(Number(getComputedStyle(element).opacity));
          if (seen.length >= 30) resolve(seen);
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
    id,
  );
}

test.describe("a batch and what's in it", () => {
  test.beforeEach(async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("loadmore"));
    expect(await initResult(page)).toBe("resolved");
  });

  test("new items aren't lost when the batch's release was waiting on an item's own reveal", async ({ page }) => {
    const waits = page.locator("#waits");
    await scrollTo(waits.locator("li").first());
    await revealDone(waits);
    await page.evaluate(async () => {
      const list = document.getElementById("waits") as HTMLElement;
      const item = document.createElement("li");
      item.id = "z";
      item.setAttribute("data-reveal-item", "");
      item.textContent = "z";
      list.append(item);
      await window.__reveal.instance?.init(list);
    });
    // x's own fade starts near the top of the viewport, and finishes.
    await page.locator("#x").evaluate((x) => window.scrollBy(0, x.getBoundingClientRect().top - window.innerHeight * 0.05));
    await revealDone(page.locator("#x"));

    await scrollTo(page.locator("#z"));
    await revealDone(waits);
    await expect(page.locator("#z")).toHaveCSS("opacity", "1");
  });

  test("a <template> or a sentinel with no box among its children doesn't keep it from finishing", async ({ page }) => {
    const list = page.locator("#templated");
    await revealDone(list);
    // An infinite scroll adds another sentinel and runs init() again.
    await page.evaluate(async () => {
      const sentinel = document.createElement("li");
      sentinel.id = "added";
      sentinel.className = "sentinel";
      document.getElementById("templated")?.append(sentinel);
      await window.__reveal.instance?.init();
    });
    for (let i = 0; i < 4; i++) await frames(page);
    await expect(list).toHaveAttribute("data-reveal-state", "done");
    // Given a box once the batch is done, it just shows.
    expect(Math.min(...(await growAndSample(page, "added")))).toBe(1);
    await expect(list).toHaveAttribute("data-reveal-state", "done");
  });

  test("a keep batch leaves a child that gets a box after it's done as it is", async ({ page }) => {
    const kept = page.locator("#kept");
    await scrollTo(kept);
    await revealDone(kept);
    expect(Math.min(...(await growAndSample(page, "grows")))).toBe(1);
    await expect(kept).toHaveAttribute("data-reveal-state", "done");
  });

  test("an item taken out mid-reveal, while another reveal on it waits, is handed back and shows as written", async ({
    page,
  }) => {
    const item = page.locator("#shared-item");
    // The batch starts on it, then its own fade starts and leaves it to the batch.
    await item.evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - window.innerHeight * 0.75));
    await expect.poll(() => item.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0);
    await item.evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - window.innerHeight * 0.5));
    for (let i = 0; i < 4; i++) await frames(page);

    const left = await page.evaluate(async () => {
      const element = document.getElementById("shared-item") as HTMLElement;
      element.remove();
      await window.__reveal.instance?.init();
      const inline = [element.style.opacity, element.style.transform];
      document.getElementById("mixed")?.append(element);
      return inline;
    });
    expect(left).toEqual(["", ""]);
    await expect(item).toHaveCSS("opacity", "1");
    expect(await leftovers(item)).toEqual(nothingLeft);
  });

  test("an item a filter takes out before it reveals, then puts back, shows as written", async ({ page }) => {
    const list = page.locator("#filtered");
    await scrollTo(list.locator("li").first());
    await expect(list.locator("li").nth(1)).toHaveCSS("opacity", "1");
    await page.evaluate(async () => {
      const c = document.getElementById("c") as HTMLElement;
      (window as unknown as { detached: HTMLElement }).detached = c;
      c.remove();
      await window.__reveal.instance?.init();
    });
    await revealDone(list);
    await page.evaluate(() => {
      document.getElementById("filtered")?.append((window as unknown as { detached: HTMLElement }).detached);
    });

    const c = page.locator("#c");
    await scrollTo(c);
    await expect(c).toHaveCSS("opacity", "1");
    await expect(c).not.toHaveAttribute("data-reveal-pending");
    expect(await leftovers(c)).toEqual(nothingLeft);
  });

  test("a load-more's refresh moves the starts of reveals below it", async ({ page }) => {
    const below = page.locator("#below-grid");
    const before = await documentTop(below);
    // The refresh the page's own init() scheduled has run.
    await page.waitForFunction(() => window.__reveal.refreshes > 0);
    await page.evaluate(async () => {
      const grid = document.getElementById("grid") as HTMLElement;
      for (let i = 0; i < 6; i++) {
        const item = document.createElement("li");
        item.setAttribute("data-reveal-item", "");
        item.className = "tall";
        grid.append(item);
      }
      await window.__reveal.instance?.init(grid);
    });
    await expect.poll(() => page.evaluate(() => window.__reveal.refreshes)).toBeGreaterThan(1);
    // Where it was is in view now, but it has moved down, so it waits.
    await page.evaluate((top) => window.scrollTo(0, top - window.innerHeight / 2), before);
    for (let i = 0; i < 5; i++) await frames(page);
    await expect(below).toHaveCSS("opacity", "0");
    await scrollTo(below);
    await revealDone(below);
  });

  test("lets go of items taken out of the page once it has finished", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "collects garbage through Chromium's DevTools protocol");
    await revealDone(page.locator("#grid"));
    await page.evaluate(() => {
      const grid = document.getElementById("grid") as HTMLElement;
      (window as unknown as { refs: Array<WeakRef<Element>> }).refs = Array.from(grid.children, (item) => new WeakRef(item));
      grid.replaceChildren();
    });
    const cdp = await page.context().newCDPSession(page);
    // Collected again, a few frames apart, until nothing is left.
    await expect
      .poll(async () => {
        await frames(page);
        await cdp.send("HeapProfiler.collectGarbage");
        return page.evaluate(
          () => (window as unknown as { refs: Array<WeakRef<Element>> }).refs.filter((ref) => ref.deref()).length,
        );
      })
      .toBe(0);
  });
});
