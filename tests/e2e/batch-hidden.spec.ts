import type { Locator, Page } from "@playwright/test";
import { expect, frames, initResult, revealDone, scrollTo, test } from "./helpers";

const opacityOf = (item: Locator) => item.evaluate((element) => getComputedStyle(element).opacity);

// Lets a few frames pass, long enough for a reveal that wrongly started to show.
async function settleFrames(page: Page): Promise<void> {
  for (let i = 0; i < 6; i++) await frames(page);
}

test("a batch hidden at init reveals its items once shown and scrolled to, not before", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("hidden"));
  expect(await initResult(page)).toBe("resolved");
  const items = page.locator("#in-hidden li");

  await page.evaluate(() => document.getElementById("section")?.classList.remove("later"));
  await settleFrames(page);
  // Below the fold now, so still waiting.
  expect(await opacityOf(items.first())).toBe("0");

  await scrollTo(page.locator("#in-hidden"));
  await revealDone(page.locator("#in-hidden"));
  for (const item of await items.all()) expect(await opacityOf(item)).toBe("1");
});

test("an item hidden below a breakpoint reveals once the viewport widens and it's scrolled to", async ({
  page,
  fixtureUrl,
}) => {
  await page.setViewportSize({ width: 600, height: 720 });
  await page.goto(fixtureUrl("hidden"));
  expect(await initResult(page)).toBe("resolved");
  const item = page.locator("#wide-only");

  await page.setViewportSize({ width: 1000, height: 720 });
  await expect(item).toBeVisible();
  await settleFrames(page);
  expect(await opacityOf(item)).toBe("0");

  await scrollTo(item);
  await revealDone(page.locator("#responsive"));
  expect(await opacityOf(item)).toBe("1");
});

test("a track with no size at init reveals its items once it has one, where it then is", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("hidden"));
  expect(await initResult(page)).toBe("resolved");
  const items = page.locator("#track li");

  // The carousel's own script sizes the track, and the layout moves it below the fold.
  await page.evaluate(() => {
    const track = document.getElementById("track") as HTMLElement;
    Object.assign(track.style, { width: "400px", height: "auto" });
    const above = document.createElement("div");
    above.className = "tall";
    document.getElementById("carousel")?.before(above);
  });
  await settleFrames(page);
  expect(await opacityOf(items.first())).toBe("0");
  // Resized again while it waits, it doesn't get a second trigger.
  await page.evaluate(() => {
    (document.getElementById("track") as HTMLElement).style.width = "500px";
  });
  await settleFrames(page);
  const triggers = await page.evaluate(async () => {
    const { ScrollTrigger } = await import("gsap/ScrollTrigger");
    const item = document.querySelector("#track li");
    return ScrollTrigger.getAll().filter((trigger) => trigger.trigger === item).length;
  });
  expect(triggers).toBe(1);

  await scrollTo(page.locator("#track"));
  await revealDone(page.locator("#track"));
  for (const item of await items.all()) expect(await opacityOf(item)).toBe("1");
});

test("an item taken out of the page before it ever had a box doesn't keep the batch from finishing", async ({
  page,
  fixtureUrl,
}) => {
  await page.goto(fixtureUrl("hidden"));
  expect(await initResult(page)).toBe("resolved");
  const drops = page.locator("#drops");
  await scrollTo(drops);
  await expect(drops.locator("li").first()).toHaveCSS("opacity", "1");
  await expect(drops).toHaveAttribute("data-reveal-state", "ready");

  await page.evaluate(async () => {
    document.getElementById("gone")?.remove();
    await window.__reveal.instance?.init(document.getElementById("drops") as HTMLElement);
  });
  await revealDone(drops);
});
