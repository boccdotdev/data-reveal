import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { types } from "../src/lib/types";

interface Cue {
  name: string;
  pitch?: number;
  played: boolean;
  ease?: string;
  pitches?: number[];
  seconds?: number;
  cut?: boolean;
}

declare global {
  interface Window {
    __cues: Cue[];
    __layouts: number;
    __audioContexts?: number;
    __engine?: { triggers: () => number };
  }
}

const scale = [0, 2, 4, 7, 9, 12];

// Every test runs offline: requests leave only for the test server. The
// font CSS from Fontshare gets an empty stylesheet, so the system fonts
// stand in, and anything else external fails the test. So does any console
// error, except those a test expects (`allowedErrors`). Each page also
// records the sound cues it plays and its layout changes.
const test = base.extend<{ allowedErrors: RegExp | null; watch: void }>({
  allowedErrors: [null, { option: true }],
  watch: [
    async ({ page, context, allowedErrors }, use) => {
      const errors: string[] = [];
      const external: string[] = [];
      await context.route(/.*/, (route) => {
        const url = new URL(route.request().url());
        if (url.hostname === "127.0.0.1") return route.continue();
        if (url.hostname === "api.fontshare.com") return route.fulfill({ contentType: "text/css", body: "" });
        external.push(url.href);
        return route.abort();
      });
      await context.addInitScript(() => {
        window.__cues = [];
        window.__layouts = 0;
        document.addEventListener("demo:sound", (event) => window.__cues.push((event as CustomEvent<Cue>).detail));
        document.addEventListener("demo:layout", () => window.__layouts++);
      });
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(String(error)));
      await use();
      expect(
        errors.filter((error) => !allowedErrors?.test(error)),
        "console errors",
      ).toEqual([]);
      expect(external, "requests to other hosts").toEqual([]);
    },
    { auto: true },
  ],
});

/** Opens a type's page and waits for its example to arm. */
async function openType(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("data-example-state", "ready", { timeout: 15_000 });
}

const reveal = (page: Page) => page.locator("[data-slot] [data-reveal]");

/** Scrolls the page until the example's element sits in the middle of the window. */
async function scrollToReveal(page: Page): Promise<void> {
  await reveal(page).evaluate((el) => el.scrollIntoView({ block: "center" }));
}

/** Waits until the settings pane on a wide screen is closed: no width left, and out of reach. */
async function settingsClosed(page: Page): Promise<void> {
  const pane = page.locator("[data-settings-pane]");
  await expect.poll(() => pane.evaluate((el) => el.getBoundingClientRect().width)).toBe(0);
  await expect(pane).toHaveAttribute("inert", "");
}

const htmlBlock = (page: Page) => page.locator("[data-live-code]");
const cues = (page: Page) => page.evaluate(() => window.__cues);
const tab = (page: Page, name: "Example" | "Code") => page.getByRole("tab", { name });

test.describe("type pages", () => {
  for (const { id, label } of types.filter((type) => type.id !== "parallax")) {
    test(`${id} plays as the page scrolls to it`, async ({ page }) => {
      await openType(page, `/${id}/`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
      // Below the fold, it waits.
      await expect(reveal(page)).toHaveAttribute("data-reveal-state", "ready");
      await scrollToReveal(page);
      await expect(reveal(page)).toHaveAttribute("data-reveal-state", "done", { timeout: 10_000 });
    });
  }

  test("parallax moves as the page scrolls", async ({ page }) => {
    await openType(page, "/parallax/");
    const transformAt = async (block: "start" | "end") => {
      await reveal(page).evaluate((el, block) => el.scrollIntoView({ block }), block);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      return reveal(page).evaluate((el) => getComputedStyle(el).transform);
    };
    const near = await transformAt("end");
    await expect.poll(() => transformAt("start")).not.toBe(near);
  });

  test("the page scrolls, not the example or the code", async ({ page }) => {
    await openType(page, "/split/");
    expect(await page.locator("iframe").count()).toBe(0);
    const scrollsOnItsOwn = (selector: string) =>
      page.locator(selector).evaluateAll((elements) =>
        // Leaving out split's visually hidden copies of its words, 1px boxes that never scroll.
        elements.some(
          (el) => el.clientHeight > 2 && el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY !== "visible",
        ),
      );
    expect(await scrollsOnItsOwn("[data-example], [data-example] *")).toBe(false);
    await tab(page, "Code").click();
    expect(await scrollsOnItsOwn("[data-code], [data-code] *")).toBe(false);
  });

  test("a type page has one GSAP, and the other pages load none", async ({ page }) => {
    await openType(page, "/split/");
    expect(await page.evaluate(() => (window as { gsapVersions?: string[] }).gsapVersions?.length)).toBe(1);
    for (const path of ["/", "/showcase-fixture/showcase/"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => (window as { gsapVersions?: string[] }).gsapVersions), path).toBeUndefined();
    }
  });
});

test.describe("navigation", () => {
  test("the nav reaches every page and marks the current one", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Site" });
    await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    for (const { id, label } of types) {
      await nav.getByRole("link", { name: id, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${id}/`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
      await expect(nav.getByRole("link", { name: id, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    }
  });

  test("the overview lists every type and links to it", async ({ page }) => {
    await page.goto("/");
    const index = page.getByRole("region", { name: "Types" });
    for (const { id, summary } of types) {
      await expect(index.getByRole("link", { name: id, exact: true })).toHaveAttribute("href", new RegExp(`/${id}/`));
      await expect(index.getByText(summary)).toBeVisible();
    }
    await expect(index.getByRole("link")).toHaveCount(types.length);
  });

  test("previous and next links step through the types", async ({ page }) => {
    await openType(page, "/fade/");
    const pager = page.getByRole("navigation", { name: "Previous and next type" });
    await expect(pager.getByRole("link", { name: /Previous/ })).toHaveCount(0);
    await pager.getByRole("link", { name: "Next: scale" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Scale");
  });
});

test.describe("settings", () => {
  test("ease, timing and a type option change the code, the example and the URL", async ({ page }) => {
    await openType(page, "/fade/");
    await expect(htmlBlock(page)).toHaveText(
      '<article data-reveal="fade">\n  <h2>Fade</h2>\n  <p>Fades in while it moves into place.</p>\n</article>',
    );

    await page.getByRole("radio", { name: "Power 3" }).check();
    await page.getByRole("radio", { name: "In", exact: true }).check();
    await page.getByLabel("Duration").fill("1");
    await page.getByRole("radio", { name: "left", exact: true }).check();

    await expect(htmlBlock(page)).toHaveText(
      `<article
  data-reveal="fade"
  data-reveal-direction="left"
  data-reveal-ease="power3.in"
  data-reveal-duration="1"
>
  <h2>Fade</h2>
  <p>Fades in while it moves into place.</p>
</article>`,
    );
    await expect(page).toHaveURL(/ease=power3\.in/);
    await expect(page).toHaveURL(/direction=left/);
    await expect(page).toHaveURL(/duration=1/);

    const el = reveal(page);
    await expect(el).toHaveAttribute("data-reveal-ease", "power3.in");
    await expect(el).toHaveAttribute("data-reveal-direction", "left");
    await expect(el).toHaveAttribute("data-reveal-duration", "1");
    await scrollToReveal(page);
    await expect(el).toHaveAttribute("data-reveal-state", "done");
  });

  test("a link with settings opens them", async ({ page }) => {
    await openType(page, "/rotate/?engine=gsap&axis=y&ease=bounce.out");
    await expect(page.getByRole("radio", { name: "y", exact: true })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Bounce" })).toBeChecked();
    await expect(htmlBlock(page)).toContainText('data-reveal-axis="y"');
    await expect(reveal(page)).toHaveAttribute("data-reveal-axis", "y");
    await expect(reveal(page)).toHaveAttribute("data-reveal-ease", "bounce.out");
  });

  test("the built-in values leave the attributes out, and reset starts over", async ({ page }) => {
    await openType(page, "/fade/");
    await page.getByRole("radio", { name: "Bounce" }).check();
    await expect(htmlBlock(page)).toContainText('data-reveal-ease="bounce.out"');
    await page.getByRole("radio", { name: "Built-in" }).check();
    await page.getByLabel("Duration").fill("0.5");
    await expect(htmlBlock(page)).toContainText('<article data-reveal="fade">');

    await page.getByRole("radio", { name: "right", exact: true }).check();
    await expect(htmlBlock(page)).toContainText("data-reveal-direction");
    await page.getByRole("button", { name: "Reset settings" }).click();
    await expect(htmlBlock(page)).toContainText('<article data-reveal="fade">');
    await expect(page.getByRole("radio", { name: "up", exact: true })).toBeChecked();
  });

  test("a type shows only the settings it reads", async ({ page }) => {
    await openType(page, "/counter/");
    await expect(page.getByLabel("Delay")).toHaveCount(0);
    await page.getByLabel("Prefix").fill("$");
    await expect(htmlBlock(page)).toContainText('data-reveal-prefix="$"');
    await openType(page, "/parallax/");
    await expect(page.getByRole("radiogroup", { name: "Ease" })).toHaveCount(0);
    await expect(page.getByLabel("Speed")).toBeVisible();
  });

  test("replay goes back to the top of the example and plays again", async ({ page }) => {
    await openType(page, "/scale/");
    await scrollToReveal(page);
    await expect(reveal(page)).toHaveAttribute("data-reveal-state", "done");

    await page.getByRole("button", { name: "Replay" }).click();
    const top = await page.locator("[data-example]").evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThan(100);
    await expect(reveal(page)).toHaveAttribute("data-reveal-state", "ready");
    await expect(reveal(page)).toHaveCSS("opacity", "0");

    await scrollToReveal(page);
    await expect(reveal(page)).toHaveAttribute("data-reveal-state", "done");
    await expect(reveal(page)).toHaveCSS("opacity", "1");
  });
});

test.describe("tabs", () => {
  test("switch between the example and the code, with the settings beside both", async ({ page }) => {
    await openType(page, "/fade/");
    await expect(tab(page, "Example")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: "Example" })).toBeVisible();
    await expect(page.getByRole("tabpanel", { name: "Code" })).toBeHidden();

    await tab(page, "Code").click();
    await expect(tab(page, "Code")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: "Code" })).toBeVisible();
    await expect(page.getByRole("tabpanel", { name: "Example" })).toBeHidden();
    await expect(page).toHaveURL(/#code$/);
    await expect(page.getByRole("region", { name: "Settings" })).toBeVisible();

    // The HTML keeps up with the settings while the code shows.
    await page.getByRole("radio", { name: "left", exact: true }).check();
    await expect(htmlBlock(page)).toContainText('data-reveal-direction="left"');
    await expect(page).toHaveURL(/direction=left#code$/);
  });

  test("arrow keys move between the tabs", async ({ page }) => {
    await openType(page, "/fade/");
    await tab(page, "Example").focus();
    await page.keyboard.press("ArrowRight");
    await expect(tab(page, "Code")).toBeFocused();
    await expect(tab(page, "Code")).toHaveAttribute("aria-selected", "true");
    await expect(tab(page, "Code")).toHaveAttribute("tabindex", "0");
    await expect(tab(page, "Example")).toHaveAttribute("tabindex", "-1");
    await page.keyboard.press("ArrowLeft");
    await expect(tab(page, "Example")).toBeFocused();
    await expect(tab(page, "Example")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(tab(page, "Code")).toHaveAttribute("aria-selected", "true");
  });

  test("#code opens the Code tab", async ({ page }) => {
    await page.goto("/batch/#code");
    await expect(tab(page, "Code")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: "Code" })).toBeVisible();
  });

  test("back on the example, it plays again", async ({ page }) => {
    await openType(page, "/blur/");
    await scrollToReveal(page);
    await expect(reveal(page)).toHaveAttribute("data-reveal-state", "done");
    await tab(page, "Code").click();
    await tab(page, "Example").click();
    await expect(reveal(page)).toHaveAttribute("data-reveal-state", "ready");
    await scrollToReveal(page);
    await expect(reveal(page)).toHaveAttribute("data-reveal-state", "done");
  });

  test("each type's Code tab shows its HTML, CSS, JS and install code", async ({ page }) => {
    for (const { id } of types) {
      await page.goto(`/${id}/#code`);
      const code = page.getByRole("tabpanel", { name: "Code" });
      for (const label of ["HTML", "CSS", "JS", "Install"]) {
        await expect(code.getByRole("region", { name: label, exact: true })).toBeVisible();
        await expect(code.getByRole("button", { name: `Copy ${label}` })).toBeVisible();
      }
      await expect(code.getByRole("region", { name: "HTML", exact: true })).toContainText(`data-reveal="${id}"`);
      await expect(code.getByRole("region", { name: "JS", exact: true })).toContainText("createReveal()");
      await expect(code.getByRole("region", { name: "CSS", exact: true })).toContainText(
        '@import "@boccdotdev/data-reveal/reveal.css";',
      );
      await expect(code.getByRole("region", { name: "Install", exact: true })).toHaveText(
        "npm install @boccdotdev/data-reveal gsap",
      );
    }
  });

  test("copying the HTML copies plain text", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Only Chromium lets a test read the clipboard");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openType(page, "/split/#code");
    await page.getByRole("radio", { name: "words", exact: true }).check();
    await page.getByRole("button", { name: "Copy HTML" }).click();
    const block = page.locator("[data-code-block]").filter({ has: page.locator("[data-live-code]") });
    await expect(block.locator("[data-copy-status]")).toHaveText("Copied");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(
      `<h2
  data-reveal="split"
  data-reveal-split="words"
>
  Text that arrives piece by piece as you scroll.
</h2>`,
    );
    expect(copied).not.toContain("<span");
  });

  test("the live and static code blocks look alike", async ({ page }) => {
    await page.goto("/fade/#code");
    const colours = (selector: string) =>
      page.locator(selector).evaluateAll((spans) => [...new Set(spans.map((span) => getComputedStyle(span).color))]);
    const live = await colours("[data-live-code] span");
    const css = await colours('pre[data-language="css"] span');
    expect(live.filter((colour) => css.includes(colour)).length).toBeGreaterThanOrEqual(2);
    const background = (selector: string) => page.locator(selector).evaluate((pre) => getComputedStyle(pre).backgroundColor);
    expect(await background("pre:has([data-live-code])")).toBe(await background('pre[data-language="css"]'));
  });
});

test.describe("panels", () => {
  test("the nav folds to a rail of icons, and stays folded after a reload", async ({ page }) => {
    await openType(page, "/fade/");
    const toggle = page.getByRole("button", { name: "Navigation" });
    const nav = page.getByRole("navigation", { name: "Site" });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const before = await page.locator("[data-example]").evaluate((el) => el.getBoundingClientRect().width);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => nav.evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(49);
    await expect.poll(() => page.locator("[data-example]").evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(before);
    // The reveals measure again once the column has its width.
    await expect.poll(() => page.evaluate(() => window.__layouts)).toBeGreaterThan(0);
    expect(await page.evaluate(() => localStorage.getItem("data-reveal-demo:nav"))).toBe("rail");

    // Every page is still a named link, with its icon, in the same order.
    const links = nav.getByRole("link");
    await expect(links).toHaveText(["Overview", ...types.map((type) => type.id), "GitHub", "npm"]);
    for (const { id } of types) {
      await expect(nav.getByRole("link", { name: id, exact: true }).locator(`svg[data-icon="${id}"]`)).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Overview" }).locator("svg")).toBeVisible();
    // The current one is inverted.
    const current = nav.getByRole("link", { name: "fade", exact: true });
    await expect(current).toHaveAttribute("aria-current", "page");
    expect(await current.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      await page.locator("body").evaluate((el) => getComputedStyle(el).color),
    );

    await openType(page, "/scale/");
    await expect(page.getByRole("button", { name: "Navigation" })).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => nav.evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(49);
    await page.getByRole("button", { name: "Navigation" }).click();
    await expect.poll(() => nav.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(150);
    await expect(nav.getByText("Types", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("data-reveal-demo:nav"))).toBe("full");
  });

  test("a rail icon shows its name on hover and focus, over the page", async ({ page, browserName }) => {
    await openType(page, "/fade/");
    await page.getByRole("button", { name: "Navigation" }).click();
    const nav = page.getByRole("navigation", { name: "Site" });
    const link = nav.getByRole("link", { name: "parallax", exact: true });
    const tip = link.locator(".nav-text");
    await expect.poll(() => nav.evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(49);
    await expect(tip).toHaveCSS("opacity", "0");
    await link.hover();
    await expect(tip).toHaveCSS("opacity", "1");
    // Past the rail's edge, and no box around it cuts it off.
    const box = await tip.boundingBox();
    const railEdge = await nav.evaluate((el) => el.getBoundingClientRect().right);
    expect(box!.x + box!.width).toBeGreaterThan(railEdge + 20);
    const clippedBy = await tip.evaluate((el) => {
      const own = el.getBoundingClientRect();
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (style.overflowX === "visible" && style.overflowY === "visible") continue;
        const edge = parent.getBoundingClientRect();
        if (own.left < edge.left || own.right > edge.right || own.top < edge.top || own.bottom > edge.bottom) {
          return parent.className || parent.tagName;
        }
      }
      return null;
    });
    expect(clippedBy).toBeNull();
    await page.mouse.move(800, 600);
    await expect(tip).toHaveCSS("opacity", "0");
    // By keyboard: from slide, Tab reaches counter. WebKit, like Safari,
    // leaves links out of the Tab order unless the user turns that on.
    if (browserName !== "webkit") {
      await nav.getByRole("link", { name: "slide", exact: true }).focus();
      await page.keyboard.press("Tab");
      await expect(nav.getByRole("link", { name: "counter", exact: true })).toBeFocused();
      await expect(nav.getByRole("link", { name: "counter", exact: true }).locator(".nav-text")).toHaveCSS("opacity", "1");
    }
    await nav.getByRole("link", { name: "counter", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Counter");
  });

  test("Escape hides a rail icon's name until another icon is pointed at", async ({ page }) => {
    await openType(page, "/fade/");
    await page.getByRole("button", { name: "Navigation" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-nav-rail", "");
    const nav = page.getByRole("navigation", { name: "Site" });
    const slide = nav.getByRole("link", { name: "slide", exact: true });
    await slide.hover();
    await expect(slide.locator(".nav-text")).toHaveCSS("opacity", "1");
    await page.keyboard.press("Escape");
    await expect(slide.locator(".nav-text")).toHaveCSS("opacity", "0");
    // Still over the same icon, it stays hidden.
    await slide.hover({ position: { x: 8, y: 8 } });
    await expect(slide.locator(".nav-text")).toHaveCSS("opacity", "0");
    const counter = nav.getByRole("link", { name: "counter", exact: true });
    await counter.hover();
    await expect(counter.locator(".nav-text")).toHaveCSS("opacity", "1");
  });

  test("with the nav folded and the settings hidden the example takes the width, and still plays", async ({ page }) => {
    await openType(page, "/fade/");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toHaveAttribute("aria-expanded", "false");
    await settingsClosed(page);
    await page.getByRole("button", { name: "Navigation" }).click();
    const viewport = page.viewportSize()?.width ?? 0;
    await expect
      .poll(() => page.locator("[data-example]").evaluate((el) => el.getBoundingClientRect().width))
      .toBeGreaterThan(viewport - 48 - 100);
    await scrollToReveal(page);
    await expect(reveal(page)).toHaveAttribute("data-reveal-state", "done");

    await page.reload();
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toHaveAttribute("aria-expanded", "false");
    await settingsClosed(page);
  });

  test("the settings pane moves its edge, border and button in one transition", async ({ page }) => {
    await openType(page, "/fade/");
    // A first real click wakes the audio engine up, which takes the main
    // thread for a moment. Done here, so it can't land in a sampled frame.
    await page.locator(".type-head").click();
    const toggle = page.getByRole("button", { name: "Settings", exact: true });
    const openX = await toggle.evaluate((el) => el.getBoundingClientRect().right);

    // Every frame from the click until it settles (at its end width for a
    // few frames, however long a loaded machine takes): the column ends
    // where the pane begins, and the pane's border is drawn at that edge
    // while any of the pane is on screen.
    const sample = (target: number) =>
      page.evaluate(
        (target) =>
          new Promise<Array<{ columnRight: number; paneLeft: number; paneWidth: number; borderLeft: number; borderWidth: string; scrolls: boolean }>>(
            (resolve) => {
              const column = document.querySelector(".column") as HTMLElement;
              const pane = document.querySelector("[data-settings-pane]") as HTMLElement;
              const inner = pane.querySelector(".settings-inner") as HTMLElement;
              const frames: Array<{ columnRight: number; paneLeft: number; paneWidth: number; borderLeft: number; borderWidth: string; scrolls: boolean }> = [];
              let start = 0;
              const record = (now: number): void => {
                if (!start) {
                  start = now;
                  (document.querySelector('[data-panel-toggle="settings"]') as HTMLElement).click();
                }
                const p = pane.getBoundingClientRect();
                frames.push({
                  columnRight: column.getBoundingClientRect().right,
                  paneLeft: p.left,
                  paneWidth: p.width,
                  borderLeft: inner.getBoundingClientRect().left,
                  borderWidth: getComputedStyle(inner).borderInlineStartWidth,
                  scrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth,
                });
                const settled = frames.length >= 4 && frames.slice(-3).every((frame) => frame.paneWidth === target);
                if (!settled && now - start < 5000) requestAnimationFrame(record);
                else resolve(frames);
              };
              requestAnimationFrame(record);
            },
          ),
        target,
      );

    for (const closing of [true, false]) {
      const frames = await sample(closing ? 0 : 392);
      expect(frames.length).toBeGreaterThan(3);
      // It moved over frames, not in one jump.
      expect(frames.some((frame) => frame.paneWidth > 1 && frame.paneWidth < 391)).toBe(true);
      for (const frame of frames) {
        expect(Math.abs(frame.columnRight - frame.paneLeft)).toBeLessThan(1);
        expect(frame.scrolls).toBe(false);
        if (frame.paneWidth >= 1) {
          expect(Math.abs(frame.borderLeft - frame.paneLeft)).toBeLessThan(1);
          expect(frame.borderWidth).toBe("1px");
        }
      }
      expect(frames.at(-1)!.paneWidth).toBe(closing ? 0 : 392);
      if (closing) {
        const closedX = await toggle.evaluate((el) => el.getBoundingClientRect().right);
        expect(closedX).toBeGreaterThan(openX + 300);
        const right = await page.evaluate(() => document.documentElement.clientWidth);
        expect(right - closedX).toBeLessThan(40);
      }
    }
    expect(await toggle.evaluate((el) => el.getBoundingClientRect().right)).toBeCloseTo(openX, 0);
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("the panels hide without a transition", async ({ page }) => {
      await openType(page, "/fade/");
      expect(await page.locator(".site").evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
      // Closed at once, and the reveals still hear about the new width.
      const width = await page.evaluate(() => {
        (document.querySelector('[data-panel-toggle="settings"]') as HTMLElement).click();
        return (document.querySelector("[data-settings-pane]") as HTMLElement).getBoundingClientRect().width;
      });
      expect(width).toBe(0);
      await expect.poll(() => page.evaluate(() => window.__layouts)).toBe(1);
    });
  });
});

test.describe("page changes", () => {
  test("go through the router, without loading the page again", async ({ page }) => {
    await openType(page, "/fade/");
    await page.evaluate(() => ((window as { marker?: number }).marker = 1));
    const nav = page.getByRole("navigation", { name: "Site" });
    for (const { id, label } of types.filter((type) => ["split", "counter", "clip"].includes(type.id))) {
      await nav.getByRole("link", { name: id, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
      await expect(page.locator("html")).toHaveAttribute("data-example-state", "ready");
      expect(await page.evaluate(() => (window as { marker?: number }).marker)).toBe(1);
      await expect(nav.getByRole("link", { name: id, exact: true })).toHaveAttribute("aria-current", "page");
      // The reveal on the new page plays, and only one GSAP has loaded.
      await expect(reveal(page)).toHaveAttribute("data-reveal-state", "ready");
      await scrollToReveal(page);
      await expect(reveal(page)).toHaveAttribute("data-reveal-state", "done");
      expect(await page.evaluate(() => (window as { gsapVersions?: string[] }).gsapVersions?.length)).toBe(1);
    }
  });

  test("leave every control with one handler: one sound per change", async ({ page }) => {
    await openType(page, "/fade/");
    const nav = page.getByRole("navigation", { name: "Site" });
    for (const id of ["scale", "fade", "scale"]) {
      await nav.getByRole("link", { name: id, exact: true }).click();
      await expect(page.locator(`[data-type-page="${id}"]`)).toHaveAttribute("data-mounted", "");
    }
    const before = (await cues(page)).length;
    await page.getByLabel("Duration").fill("1");
    await expect.poll(async () => (await cues(page)).length).toBe(before + 1);
    await page.getByRole("radio", { name: "Expo" }).check();
    await expect.poll(async () => (await cues(page)).length).toBe(before + 2);
    // And one rebuild: the example and the code show the change once.
    await expect(reveal(page)).toHaveAttribute("data-reveal-ease", "expo.out");
    await expect(htmlBlock(page)).toContainText('data-reveal-ease="expo.out"');
  });

  test("back and forward bring pages back, settings and #code included", async ({ page }) => {
    await openType(page, "/fade/");
    await page.getByRole("radio", { name: "left", exact: true }).check();
    await tab(page, "Code").click();
    await expect(page).toHaveURL(/\/fade\/\?.*direction=left.*#code$/);
    await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "scale", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Scale");

    await page.goBack();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fade");
    await expect(tab(page, "Code")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("radio", { name: "left", exact: true })).toBeChecked();
    await expect(htmlBlock(page)).toContainText('data-reveal-direction="left"');

    await page.goForward();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Scale");
    await scrollToReveal(page);
    await expect(reveal(page)).toHaveAttribute("data-reveal-state", "done");
  });

  test("the nav stays, folded or not, with its scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 420 });
    await openType(page, "/fade/");
    const inner = page.locator(".nav-inner");
    await inner.evaluate((el) => (el.scrollTop = el.scrollHeight));
    const scrolled = await inner.evaluate((el) => el.scrollTop);
    expect(scrolled).toBeGreaterThan(0);
    await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "parallax", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Parallax");
    expect(await inner.evaluate((el) => el.scrollTop)).toBe(scrolled);

    await page.getByRole("button", { name: "Navigation" }).click();
    await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "Overview" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Scroll reveals from HTML attributes.");
    await expect(page.locator("html")).toHaveAttribute("data-nav-rail", "");
    await expect(page.getByRole("button", { name: "Navigation" })).toHaveAttribute("aria-expanded", "false");
  });

  test("the settings sit behind a rule, beside the content or above it on a phone", async ({ page }) => {
    await openType(page, "/fade/");
    const rule = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.color = "var(--rule)";
      document.body.append(probe);
      return getComputedStyle(probe).color;
    });
    const pane = page.locator("[data-settings-pane]");
    const inner = pane.locator(".settings-inner");
    await expect(inner).toHaveCSS("border-inline-start-width", "1px");
    await expect(inner).toHaveCSS("border-inline-start-color", rule);
    // It runs the full height of the window, past the bar along the top.
    expect(await pane.evaluate((el) => [el.getBoundingClientRect().top, el.getBoundingClientRect().height])).toEqual([
      0,
      await page.evaluate(() => innerHeight),
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(inner).toHaveCSS("border-inline-start-width", "0px");
    await expect(pane).toHaveCSS("border-block-start-color", rule);
  });
});

test.describe("bars", () => {
  const bottomOf = async (page: Page) => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };

  test("the top bar holds the panel buttons, and the tabs have a sticky row of their own", async ({ page }) => {
    await openType(page, "/fade/");
    const bar = page.locator(".panel-bar");
    await expect(bar.getByRole("button")).toHaveText(["Navigation", "Settings"]);
    await expect(bar.getByRole("tab")).toHaveCount(0);
    await expect(page.locator(".tabs-row").getByRole("tab")).toHaveText(["Example", "Code"]);
    const barBottom = await bar.evaluate((el) => el.getBoundingClientRect().bottom);
    for (const at of [0.5, 1]) {
      await page.evaluate((at) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * at), at);
      const row = await page.locator(".tabs-row").evaluate((el) => el.getBoundingClientRect().top);
      expect(Math.abs(row - barBottom)).toBeLessThanOrEqual(1);
      await expect(tab(page, "Code")).toBeInViewport();
    }
    await bottomOf(page);
    await tab(page, "Code").click();
    await expect(tab(page, "Code")).toHaveAttribute("aria-selected", "true");
  });

  test("Replay sits in the example and stays in reach while it scrolls by", async ({ page }) => {
    await openType(page, "/fade/");
    const replay = page.getByRole("button", { name: "Replay" });
    await expect(page.getByRole("tabpanel", { name: "Example" }).getByRole("button", { name: "Replay" })).toHaveCount(1);
    await scrollToReveal(page);
    await expect(reveal(page)).toHaveAttribute("data-reveal-state", "done");
    await page.evaluate(() => window.scrollBy(0, 400));
    await expect(replay).toBeInViewport();
    const rowBottom = await page.locator(".tabs-row").evaluate((el) => el.getBoundingClientRect().bottom);
    expect(await replay.evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThan(rowBottom);
    await replay.click();
    await expect(reveal(page)).toHaveAttribute("data-reveal-state", "ready");
    await tab(page, "Code").click();
    await expect(replay).toBeHidden();
  });

  test("Code from deep in the example opens at the top of the code", async ({ page }) => {
    await openType(page, "/fade/");
    await scrollToReveal(page);
    await page.evaluate(() => window.scrollBy(0, 600));
    await tab(page, "Code").click();
    const barBottom = await page.locator(".tabs-row").evaluate((el) => el.getBoundingClientRect().bottom);
    await expect
      .poll(async () => Math.abs((await page.getByRole("tabpanel", { name: "Code" }).evaluate((el) => el.getBoundingClientRect().top)) - barBottom))
      .toBeLessThanOrEqual(1);
  });

  test("previous and next stay along the bottom, in line with the nav's last row", async ({ page }) => {
    await openType(page, "/scale/");
    const pager = page.getByRole("navigation", { name: "Previous and next type" });
    await expect(pager.getByRole("link", { name: "Previous: fade" }).locator('svg[data-icon="fade"]')).toHaveCount(1);
    await expect(pager.getByRole("link", { name: "Next: split" }).locator('svg[data-icon="split"]')).toHaveCount(1);
    const height = await page.evaluate(() => innerHeight);
    const textBottom = (selector: string, text: string) =>
      page.evaluate(
        ([selector, text]) => {
          const host = document.querySelector(selector) as Element;
          const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (node.textContent?.trim() === text) {
              const range = document.createRange();
              range.selectNodeContents(node);
              return range.getBoundingClientRect().bottom;
            }
          }
          return Number.NaN;
        },
        [selector, text],
      );
    for (const at of [0, 0.5, 1]) {
      await page.evaluate((at) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * at), at);
      await expect(pager).toBeInViewport();
      expect(await pager.evaluate((el) => el.getBoundingClientRect().bottom)).toBeCloseTo(height, 0);
      const nav = await page.locator(".nav-foot").evaluate((el) => [el.getBoundingClientRect().top, el.getBoundingClientRect().bottom]);
      const bar = await pager.evaluate((el) => [el.getBoundingClientRect().top, el.getBoundingClientRect().bottom]);
      expect(Math.abs(nav[0] - bar[0])).toBeLessThanOrEqual(1);
      expect(Math.abs(nav[1] - bar[1])).toBeLessThanOrEqual(1);
      expect(Math.abs((await textBottom(".nav-foot", "Sound")) - (await textBottom(".pager", "fade")))).toBeLessThanOrEqual(1);
    }
    // Folded to the rail, the speaker's row lines up the same way.
    await page.getByRole("button", { name: "Navigation" }).click();
    await expect.poll(() => page.getByRole("navigation", { name: "Site" }).evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(49);
    const rail = await page.locator(".nav-foot").evaluate((el) => [el.getBoundingClientRect().top, el.getBoundingClientRect().bottom]);
    const bar = await pager.evaluate((el) => [el.getBoundingClientRect().top, el.getBoundingClientRect().bottom]);
    expect(Math.abs(rail[0] - bar[0])).toBeLessThanOrEqual(1);
    const speaker = await page.locator(".sound-glyph").evaluate((el) => {
      const box = el.getBoundingClientRect();
      return box.top + box.height / 2;
    });
    expect(Math.abs(speaker - (bar[0] + bar[1]) / 2)).toBeLessThanOrEqual(1);
  });

  test("GitHub and npm sit at the foot of the nav's box, and the last row is the sound switch", async ({ page }) => {
    await openType(page, "/fade/");
    const nav = page.getByRole("navigation", { name: "Site" });
    const foot = page.locator(".nav-foot");
    // Full nav: every link in order, GitHub and npm last, with their marks.
    await expect(nav.getByRole("link")).toHaveText([
      "data-reveal",
      "Overview",
      ...types.map((type) => type.id),
      "GitHub",
      "npm",
    ]);
    const github = nav.getByRole("link", { name: "GitHub" });
    const npm = nav.getByRole("link", { name: "npm" });
    await expect(github).toHaveAttribute("href", "https://github.com/boccdotdev/data-reveal");
    await expect(npm).toHaveAttribute("href", "https://www.npmjs.com/package/@boccdotdev/data-reveal");
    for (const link of [github, npm]) await expect(link.locator(".nav-mark")).toBeVisible();
    const placed = async () => {
      const footTop = await foot.evaluate((el) => el.getBoundingClientRect().top);
      const npmBottom = await npm.evaluate((el) => el.getBoundingClientRect().bottom);
      const githubTop = await github.evaluate((el) => el.getBoundingClientRect().top);
      const lastType = await nav.getByRole("link", { name: "parallax", exact: true }).evaluate((el) => el.getBoundingClientRect().bottom);
      // Pinned to the bottom of the box, above the bottom rule, below the types.
      expect(npmBottom).toBeLessThanOrEqual(footTop);
      expect(footTop - npmBottom).toBeLessThan(40);
      expect(githubTop).toBeGreaterThan(lastType);
    };
    await placed();
    // The last row holds only the sound switch, at the left like the links.
    await expect(foot.getByRole("link")).toHaveCount(0);
    const sound = page.getByRole("switch", { name: "Sound" });
    await expect(foot.getByRole("switch")).toHaveCount(1);
    const left = async (el: typeof sound) => el.evaluate((node) => node.getBoundingClientRect().left);
    expect(Math.abs((await left(sound)) - (await left(nav.getByRole("link", { name: "Overview" }))))).toBeLessThanOrEqual(1);
    await expect(sound.locator(".sound-glyph")).toBeVisible();
    await expect(sound.locator(".sound-waves")).toBeVisible();
    await expect(sound).toContainText(/Sound\s*on/);
    await sound.click();
    await expect(sound).toContainText(/Sound\s*off/);
    await expect(sound.locator(".sound-waves")).toBeHidden();

    // Rail: the same, as icons with their names on hover.
    await page.getByRole("button", { name: "Navigation" }).click();
    await expect.poll(() => nav.evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(49);
    await placed();
    for (const link of [github, npm]) {
      await expect(link.locator(".nav-mark")).toBeVisible();
      const tip = link.locator(".nav-text");
      await expect(tip).toHaveCSS("opacity", "0");
      await link.hover();
      await expect(tip).toHaveCSS("opacity", "1");
    }
  });

  test("type pages have no footer links: GitHub and npm are in the nav only", async ({ page }) => {
    await openType(page, "/split/");
    await expect(page.locator("footer")).toHaveCount(0);
    await expect(page.locator('a[href*="github.com"], a[href*="npmjs.com"]')).toHaveCount(2);
    await expect(page.getByRole("navigation", { name: "Site" }).locator('a[href*="github.com"], a[href*="npmjs.com"]')).toHaveCount(2);
  });

  test("the type's heading sits above the tabs and scrolls away", async ({ page }) => {
    await openType(page, "/split/");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Split");
    await expect(page.locator(".type-head .summary")).toHaveText(/Splits text/);
    const row = page.locator(".tabs-row");
    expect(await heading.evaluate((el) => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(
      await row.evaluate((el) => el.getBoundingClientRect().top),
    );
    await expect(page.locator("[data-example] .type-head, [data-example] h1")).toHaveCount(0);
    await scrollToReveal(page);
    expect(await heading.evaluate((el) => el.getBoundingClientRect().bottom)).toBeLessThan(0);
    const barBottom = await page.locator(".panel-bar").evaluate((el) => el.getBoundingClientRect().bottom);
    expect(Math.abs((await row.evaluate((el) => el.getBoundingClientRect().top)) - barBottom)).toBeLessThanOrEqual(1);
  });

  test("the scroll hint points down with an arrow in the icons' stroke", async ({ page }) => {
    await openType(page, "/fade/");
    const arrow = page.locator(".hint .hint-arrow");
    await expect(arrow).toBeVisible();
    await expect(arrow).toHaveCSS("stroke-linecap", "square");
    await expect(arrow).toHaveCSS("stroke-width", "1.5px");
    expect(await arrow.evaluate((el) => el.getAnimations().length)).toBe(0);
  });

  test("nothing ends up hidden under the bottom bar", async ({ page }) => {
    for (const path of ["/split/", "/split/#code"]) {
      await openType(page, path);
      await bottomOf(page);
      const pagerTop = await page.locator(".pager").evaluate((el) => el.getBoundingClientRect().top);
      const lastBottom = await page.locator("main").evaluate((el) => el.getBoundingClientRect().bottom);
      expect(lastBottom).toBeLessThanOrEqual(pagerTop + 0.5);
      if (path.endsWith("#code")) {
        const blockBottom = await page.locator("[data-code-block]").last().evaluate((el) => el.getBoundingClientRect().bottom);
        expect(blockBottom).toBeLessThanOrEqual(pagerTop);
      }
    }
  });

  test("Copy says Copied for a moment, then Copy again, at one width", async ({ page }) => {
    // The page's clock is the test's, so the moment is exact however busy
    // the machine is.
    await page.clock.install();
    await page.goto("/fade/#code");
    const button = page.getByRole("button", { name: "Copy JS" });
    const label = button.locator("[data-copy-label]");
    const width = () => button.evaluate((el) => el.getBoundingClientRect().width);
    await expect(label).toHaveText("Copy");
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
    const before = await width();
    await button.click();
    await expect(label).toHaveText(/^(Copied|Failed)$/);
    expect(await width()).toBe(before);
    // A second click starts the moment over: 1.8s after the first, it
    // still says so.
    await page.clock.runFor(900);
    await expect(label).toHaveText(/^(Copied|Failed)$/);
    // The click's handler goes on after the clipboard answers, and empties
    // the live region then (it's filled again on the next frame). Only once
    // it has does the clock move on.
    const status = page.locator("[data-code-block]").filter({ has: button }).locator("[data-copy-status]");
    await expect(status).not.toHaveText("");
    await button.click();
    await expect(status).toHaveText("");
    await page.clock.runFor(900);
    await expect(label).toHaveText(/^(Copied|Failed)$/);
    await page.clock.runFor(700);
    await expect(label).toHaveText("Copy");
    expect(await width()).toBe(before);
    // No text beside the button: the status is for screen readers only.
    await expect(page.locator("[data-copy-status]").first()).toHaveClass(/visually-hidden/);
  });
});

test.describe("engines", () => {
  test("Motion and Vanilla can't be picked", async ({ page }) => {
    await openType(page, "/fade/");
    for (const name of ["Motion", "Vanilla"]) {
      const engine = page.getByRole("radio", { name });
      await expect(engine).toBeDisabled();
      await expect(engine).toHaveAttribute("aria-disabled", "true");
      await page.locator(".segment", { hasText: name }).click({ force: true });
      await expect(engine).not.toBeChecked();
    }
    await expect(page.getByRole("radio", { name: "GSAP" })).toBeChecked();
    await expect(page.getByText("Vanilla: coming in 1.0.")).toBeVisible();
  });

  test("the engine choice goes with you from page to page", async ({ page }) => {
    await openType(page, "/fade/?engine=gsap");
    expect(await page.evaluate(() => localStorage.getItem("data-reveal-demo:engine"))).toBe("gsap");
    const nav = page.getByRole("navigation", { name: "Site" });
    await expect(nav.getByRole("link", { name: "slide", exact: true })).toHaveAttribute("href", /engine=gsap/);
    await nav.getByRole("link", { name: "slide", exact: true }).click();
    await expect(page).toHaveURL(/\/slide\/\?engine=gsap/);
    await expect(page.getByRole("radio", { name: "GSAP" })).toBeChecked();
  });

  test("an engine that can't run yet falls back to GSAP and isn't remembered", async ({ page }) => {
    await openType(page, "/fade/?engine=vanilla");
    await expect(page.getByRole("radio", { name: "GSAP" })).toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem("data-reveal-demo:engine"))).toBeNull();
    expect(await page.evaluate(() => (window as { gsapVersions?: string[] }).gsapVersions?.length)).toBe(1);
  });
});

test.describe("sound", () => {
  const lastEase = async (page: Page) => (await cues(page)).filter((cue) => cue.name === "ease").at(-1) as Cue;

  test("an ease sounds like its curve", async ({ page }) => {
    await openType(page, "/fade/");
    await page.getByRole("radio", { name: "Linear" }).check();
    const linear = await lastEase(page);
    expect(linear.ease).toBe("none");
    expect(linear.pitches?.[0]).toBe(0);
    expect(linear.pitches?.at(-1)).toBe(12);
    // A straight glide: every step the same size.
    const steps = linear.pitches!.slice(1).map((pitch, i) => pitch - linear.pitches![i]);
    expect(Math.max(...steps) - Math.min(...steps)).toBeLessThan(0.05);

    await page.getByRole("radio", { name: "Elastic" }).check();
    const elastic = await lastEase(page);
    expect(elastic.ease).toBe("elastic.out");
    // Past the top, then settles at it.
    expect(Math.max(...elastic.pitches!)).toBeGreaterThan(12);
    expect(elastic.pitches?.at(-1)).toBe(12);

    await page.getByRole("radio", { name: "Bounce" }).check();
    const bounce = await lastEase(page);
    const falls = bounce.pitches!.slice(1).filter((pitch, i) => pitch < bounce.pitches![i]);
    expect(falls.length).toBeGreaterThan(0);

    await page.getByRole("radio", { name: "In", exact: true }).check();
    expect((await lastEase(page)).ease).toBe("bounce.in");

    await page.getByRole("radio", { name: "Built-in" }).check();
    expect((await lastEase(page)).ease).toBe("back.out(1.4)");
  });

  test("a new ease cuts off the one still sounding, and the length follows the duration", async ({ page }) => {
    // Time stands still from here, so the second pick is always within the
    // first one's sound.
    await page.clock.install();
    await openType(page, "/fade/");
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
    await page.getByLabel("Duration").fill("2");
    await page.getByRole("radio", { name: "Sine" }).check();
    await page.getByRole("radio", { name: "Expo" }).check();
    const [first, second] = (await cues(page)).filter((cue) => cue.name === "ease").slice(-2);
    expect(first.seconds).toBe(0.6);
    expect(second.cut).toBe(true);
    await page.getByLabel("Duration").fill("0.1");
    await page.getByRole("radio", { name: "Circ" }).check();
    expect((await lastEase(page)).seconds).toBe(0.25);
  });

  test("a slider's cue rises with its value, on the scale, by drag or key", async ({ page }) => {
    await openType(page, "/fade/");
    const duration = page.getByLabel("Duration");
    await duration.fill("0.1");
    await duration.fill("2");
    const [low, high] = (await cues(page)).filter((cue) => cue.name === "tick").slice(-2);
    expect(low.pitch).toBe(0);
    expect(high.pitch).toBe(12);
    await duration.focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    const stepped = (await cues(page)).at(-1);
    expect(stepped?.name).toBe("tick");
    expect(scale).toContain(stepped?.pitch);
  });

  test("a segmented control's options sound different notes, left to right", async ({ page }) => {
    await openType(page, "/fade/");
    await page.getByRole("radio", { name: "right", exact: true }).check();
    await page.getByRole("radio", { name: "up", exact: true }).check();
    const [right, up] = (await cues(page)).filter((cue) => cue.name === "on").slice(-2);
    expect(up.pitch).toBe(scale[0]);
    expect(right.pitch).toBeGreaterThan(up.pitch!);
    expect(scale).toContain(right.pitch);
  });

  test("switches say on and off without a pitch, and tabs switch with a step", async ({ page }) => {
    await openType(page, "/fade/");
    await page.getByLabel("Reverse").check();
    await page.getByLabel("Reverse").uncheck();
    const [on, off] = (await cues(page)).slice(-2);
    expect(on).toMatchObject({ name: "on", pitch: 0 });
    expect(off).toMatchObject({ name: "off", pitch: 0 });
    await tab(page, "Code").click();
    expect((await cues(page)).at(-1)).toMatchObject({ name: "switch", pitch: scale[1] });
    await tab(page, "Example").focus();
    await page.keyboard.press("ArrowLeft");
    expect((await cues(page)).at(-1)?.name).toBe("switch");
  });

  test("the example itself makes no sound", async ({ page }) => {
    await openType(page, "/fade/");
    await scrollToReveal(page);
    await expect(reveal(page)).toHaveAttribute("data-reveal-state", "done");
    expect(await cues(page)).toEqual([]);
  });

  test("the sound switch is remembered", async ({ page }) => {
    await page.goto("/");
    const sound = page.getByRole("switch", { name: "Sound" });
    await expect(sound).toHaveAttribute("aria-checked", "true");
    await sound.click();
    await expect(sound).toHaveAttribute("aria-checked", "false");
    await page.goto("/fade/");
    await expect(page.getByRole("switch", { name: "Sound" })).toHaveAttribute("aria-checked", "false");
  });
});

test.describe("system settings", () => {
  test.describe("dark", () => {
    test.use({ colorScheme: "dark" });
    test("the page and the example are dark", async ({ page }) => {
      await openType(page, "/fade/");
      await expect(page.locator("body")).toHaveCSS("background-color", "rgb(40, 40, 40)");
    });
  });

  test.describe("light", () => {
    test.use({ colorScheme: "light" });
    test("the page is light, and the code stays dark", async ({ page }) => {
      await page.goto("/fade/#code");
      await expect(page.locator("body")).toHaveCSS("background-color", "rgb(242, 242, 242)");
      await expect(page.locator("pre:has([data-live-code])")).toHaveCSS("background-color", "rgb(30, 30, 30)");
    });
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("says so, and the reveal shows without playing", async ({ page }) => {
      await openType(page, "/fade/");
      await expect(page.getByText("asks for reduced motion")).toBeVisible();
      await expect(reveal(page)).toHaveAttribute("data-reveal-state", "done");
    });
  });
});

test.describe("narrow screens", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const noSidewaysScroll = (page: Page) =>
    expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  test("the settings are a drawer, and nothing scrolls sideways", async ({ page }) => {
    await openType(page, "/fade/");
    await noSidewaysScroll(page);
    // The nav's own bar has Menu and Settings; the tabs have the row under it.
    await expect(page.locator(".panel-bar")).toBeHidden();
    await expect(page.locator(".tabs-row")).toBeVisible();
    const toggle = page.getByRole("button", { name: "Settings", exact: true });
    await expect(page.getByRole("region", { name: "Settings" })).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("region", { name: "Settings" })).toBeVisible();
    await page.getByRole("radio", { name: "left", exact: true }).check();
    await expect(reveal(page)).toHaveAttribute("data-reveal-direction", "left");
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("region", { name: "Settings" })).toBeHidden();
    await scrollToReveal(page);
    await expect(reveal(page)).toHaveAttribute("data-reveal-state", "done");
    await noSidewaysScroll(page);
  });

  test("the bars stay clear of the open settings drawer", async ({ page }) => {
    await openType(page, "/fade/");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const drawer = await page.locator("[data-settings-pane]").evaluate((el) => {
      const box = el.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
    });
    const topBars = await page.locator(".tabs-row").evaluate((el) => el.getBoundingClientRect().bottom);
    expect(drawer.top).toBeGreaterThanOrEqual(topBars);
    // Where the bottom bar sits, the drawer is what shows.
    const pager = await page.locator(".pager").evaluate((el) => {
      const box = el.getBoundingClientRect();
      return [box.left + 20, box.top + box.height / 2];
    });
    expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("[data-settings-pane]") !== null, pager)).toBe(true);
    // Tabs and buttons are at least 44px to tap.
    for (const control of [tab(page, "Example"), tab(page, "Code"), page.getByRole("button", { name: "Menu" })]) {
      const box = await control.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("every control below 60rem is at least 44px to tap", async ({ page }) => {
    const atLeast44 = async (locator: Locator, what: string) => {
      const boxes = await locator.evaluateAll((elements) =>
        elements
          .filter((el) => el.getClientRects().length > 0)
          .map((el) => {
            const box = el.getBoundingClientRect();
            const name = el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "";
            return { width: box.width, height: box.height, name: `${el.tagName} ${name}`.slice(0, 40) };
          }),
      );
      expect(boxes.length, `${what} on the page`).toBeGreaterThan(0);
      for (const box of boxes) {
        expect(box.height, `${what}: ${box.name}`).toBeGreaterThanOrEqual(44);
        expect(box.width, `${what}: ${box.name}`).toBeGreaterThanOrEqual(44);
      }
    };
    await openType(page, "/split/");
    await atLeast44(page.locator('[role="tab"]'), "tabs");
    await atLeast44(page.locator(".wordmark"), "wordmark");
    await atLeast44(page.locator(".nav-buttons .bar-button"), "bar buttons");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const pane = page.locator("[data-settings-pane]");
    await atLeast44(pane.locator(".segment"), "segments");
    await atLeast44(pane.locator('input[type="range"]'), "sliders");
    await atLeast44(pane.locator('[role="switch"]'), "switches");
    await atLeast44(pane.locator("select"), "selects");
    await atLeast44(pane.locator(".reset"), "reset");
    await openType(page, "/counter/");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await atLeast44(pane.locator('input[type="text"]'), "text fields");
    await page.getByRole("button", { name: "Menu" }).click();
    await atLeast44(page.locator("#nav-menu .nav-links a"), "menu links");
    await atLeast44(page.locator("#nav-menu .sound-toggle"), "sound switch");
  });

  // Where focus is: in the drawer, on the bar with the drawer buttons,
  // nowhere (between the end of the page and its start), or behind.
  const focusIn = (page: Page, drawer: string) =>
    page.evaluate((drawer) => {
      const active = document.activeElement;
      if (!active || active === document.body) return "none";
      if (active.closest(drawer)) return "drawer";
      if (active.closest(".nav-bar")) return "bar";
      return `behind: ${active.outerHTML.slice(0, 80)}`;
    }, drawer);

  for (const { name, drawer } of [
    { name: "Settings", drawer: "[data-settings-pane]" },
    { name: "Menu", drawer: "#nav-menu" },
  ]) {
    test(`the ${name} drawer takes focus, keeps Tab out of the page behind, and gives focus back`, async ({ page, browserName }) => {
      await openType(page, "/fade/");
      const toggle = page.getByRole("button", { name, exact: true });
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(await focusIn(page, drawer)).toBe("drawer");
      await expect(page.locator(".column")).toHaveAttribute("inert", "");
      // Back out of the drawer is the bar with the drawer buttons (WebKit,
      // like Safari, leaves buttons out of the Tab order, so there it's
      // nowhere), and on from there is the drawer again.
      let back = "drawer";
      for (let i = 0; i < 30 && back === "drawer"; i++) {
        await page.keyboard.press("Shift+Tab");
        back = await focusIn(page, drawer);
      }
      expect(back).toBe(browserName === "webkit" ? "none" : "bar");
      if (browserName !== "webkit") {
        await page.keyboard.press("Tab");
        expect(await focusIn(page, drawer)).toBe("drawer");
      }
      // On through the drawer and past its end, nothing behind it takes
      // focus. (Past the end, browsers differ: back to the top, or out to
      // their own controls.)
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press("Tab");
        expect(await focusIn(page, drawer)).toMatch(/^(drawer|bar|none)$/);
      }
      // Escape closes it and puts focus back on its button.
      await page.keyboard.press("Escape");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(toggle).toBeFocused();
      await expect(page.locator(".column")).not.toHaveAttribute("inert", "");
      // So does the button.
      await toggle.click();
      expect(await focusIn(page, drawer)).toBe("drawer");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(toggle).toBeFocused();
      await expect(page.locator(".column")).not.toHaveAttribute("inert", "");
    });
  }

  test("a long line scrolls inside its code block", async ({ page }) => {
    await page.goto("/fade/#code");
    const js = page.locator('pre[data-language="js"]');
    await js.scrollIntoViewIfNeeded();
    expect(await js.evaluate((pre) => pre.scrollWidth > pre.clientWidth)).toBe(true);
    await js.evaluate((pre) => pre.scrollBy(200, 0));
    expect(await js.evaluate((pre) => pre.scrollLeft)).toBeGreaterThan(0);
    await noSidewaysScroll(page);
  });

  test("the menu drawer lists every page, then GitHub and npm, then the sound switch", async ({ page }) => {
    await page.goto("/fade/");
    await page.getByRole("button", { name: "Menu" }).click();
    const menu = page.locator("#nav-menu");
    await expect(menu.getByRole("link")).toHaveText(["Overview", ...types.map((type) => type.id), "GitHub", "npm"]);
    await expect(menu.getByRole("link", { name: "npm" })).toBeVisible();
    const npmBottom = await menu.getByRole("link", { name: "npm" }).evaluate((el) => el.getBoundingClientRect().bottom);
    expect(await menu.getByRole("switch", { name: "Sound" }).evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThan(npmBottom);
  });

  test("the nav is a menu that opens and closes", async ({ page }) => {
    await page.goto("/fade/");
    const toggle = page.getByRole("button", { name: "Menu" });
    const link = page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "batch", exact: true });
    await expect(link).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(link).toBeVisible();
    await noSidewaysScroll(page);
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(link).toBeHidden();
    await toggle.click();
    await link.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Batch");
  });
});

test.describe("when things go wrong", () => {
  test.describe("a type's code fails to load", () => {
    test.use({
      allowedErrors:
        /Failed to load resource|dynamically imported module|Importing a module script failed|Loading failed for the module|Loading module from .* was blocked/i,
    });

    test("the content shows and the page still works", async ({ page }) => {
      await page.route("**/_astro/fade.*.js", (route) => route.abort());
      await openType(page, "/fade/");
      await expect(reveal(page)).toHaveAttribute("data-reveal-state", "failed");
      await expect(reveal(page)).toHaveCSS("opacity", "1");
      await expect(reveal(page)).toBeVisible();
      // Settings still change the code, the example and the URL.
      await page.getByRole("radio", { name: "left", exact: true }).check();
      await expect(page).toHaveURL(/direction=left/);
      await expect(reveal(page)).toHaveAttribute("data-reveal-direction", "left");
      await expect(reveal(page)).toHaveAttribute("data-reveal-state", "failed");
      await expect(reveal(page)).toHaveCSS("opacity", "1");
      await page.getByRole("button", { name: "Replay" }).click();
      await expect(reveal(page)).toHaveAttribute("data-reveal-state", "failed");
      await page.getByRole("button", { name: "Reset settings" }).click();
      await expect(page.getByRole("radio", { name: "up", exact: true })).toBeChecked();
      // The tabs and the code.
      await tab(page, "Code").click();
      await expect(page.getByRole("tabpanel", { name: "Code" })).toBeVisible();
      await expect(htmlBlock(page)).toContainText('<article data-reveal="fade">');
      await tab(page, "Example").click();
      await expect(reveal(page)).toBeVisible();
      // And the panels.
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await settingsClosed(page);
    });
  });

  test("without Web Audio the page works, silently, with no sound switch", async ({ page }) => {
    await page.addInitScript(() => {
      Reflect.deleteProperty(window, "AudioContext");
      Reflect.deleteProperty(window, "webkitAudioContext");
    });
    await openType(page, "/fade/");
    expect(await page.evaluate(() => typeof AudioContext)).toBe("undefined");
    await expect(page.locator("[data-sound-toggle]")).toBeHidden();
    await page.getByRole("radio", { name: "Bounce" }).check();
    await page.getByRole("radio", { name: "left", exact: true }).check();
    await page.getByLabel("Duration").fill("1");
    await page.getByRole("switch", { name: "Keep end state" }).check();
    await tab(page, "Code").click();
    await page.getByRole("button", { name: "Copy JS" }).click();
    await tab(page, "Example").click();
    await page.getByRole("button", { name: "Replay" }).click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Navigation" }).click();
    await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "slide", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Slide");
    expect(await cues(page)).toEqual([]);
  });

  test("no audio starts before the first gesture", async ({ page }) => {
    await page.addInitScript(() => {
      window.__audioContexts = 0;
      const Original = window.AudioContext;
      window.AudioContext = class extends Original {
        constructor(options?: AudioContextOptions) {
          super(options);
          window.__audioContexts = (window.__audioContexts ?? 0) + 1;
        }
      };
    });
    await openType(page, "/fade/");
    await page.mouse.wheel(0, 400);
    await scrollToReveal(page);
    await expect(reveal(page)).toHaveAttribute("data-reveal-state", "done");
    expect(await page.evaluate(() => window.__audioContexts)).toBe(0);
    await page.getByRole("radio", { name: "left", exact: true }).check();
    await expect.poll(() => page.evaluate(() => window.__audioContexts)).toBeGreaterThan(0);
  });

  test("rebuilds and page changes leave no reveals or triggers behind", async ({ page }) => {
    await openType(page, "/fade/?test");
    const count = () =>
      page.evaluate(() => ({
        triggers: window.__engine?.triggers(),
        states: document.querySelectorAll("[data-reveal-state]").length,
        slot: document.querySelector("[data-slot]")?.childElementCount,
      }));
    const start = await count();
    expect(start.triggers).toBeGreaterThan(0);
    expect(start.slot).toBe(1);

    // Twenty rebuilds: every other one straight after the last.
    for (let i = 0; i < 20; i++) {
      await page.getByRole("button", { name: "Replay" }).click();
      if (i % 2 === 1) await expect(reveal(page)).toHaveAttribute("data-reveal-state", "ready");
    }
    await expect(reveal(page)).toHaveAttribute("data-reveal-state", "ready");
    await expect.poll(count).toEqual(start);

    // A settings change rebuilds too.
    for (const direction of ["left", "up", "right"]) {
      await page.getByRole("radio", { name: direction, exact: true }).check();
    }
    await expect(reveal(page)).toHaveAttribute("data-reveal-direction", "right");
    await expect.poll(count).toEqual(start);

    // Five page changes through the router, and back.
    const nav = page.getByRole("navigation", { name: "Site" });
    for (const [id, label] of [
      ["slide", "Slide"],
      ["fade", "Fade"],
      ["slide", "Slide"],
      ["fade", "Fade"],
      ["slide", "Slide"],
      ["fade", "Fade"],
    ]) {
      await nav.getByRole("link", { name: id, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
      await expect(page.locator("html")).toHaveAttribute("data-example-state", "ready");
    }
    await expect(reveal(page)).toHaveAttribute("data-reveal-state", "ready");
    await expect.poll(count).toEqual(start);
  });

  test.describe("an unknown address", () => {
    test.use({ allowedErrors: /status of 404/ });
    test("shows the not-found page, with a way back", async ({ page }) => {
      const response = await page.goto("/no-such-page/");
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Not found");
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await page.getByRole("link", { name: "Go to the overview" }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Scroll reveals from HTML attributes.");
    });
  });
});

test.describe("showcase", () => {
  test.describe("while no sites are listed", () => {
    test.use({ allowedErrors: /status of 404/ });
    test("isn't built or linked", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "Showcase" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Sites built with it" })).toHaveCount(0);
      const response = await page.goto("/showcase/");
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Not found");
    });
  });

  test("is in the nav and linked from the overview once a site is listed", async ({ page }) => {
    await page.goto("/showcase-fixture/");
    await page.getByRole("link", { name: "Sites built with it" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Showcase");
    const nav = page.getByRole("navigation", { name: "Site" });
    await expect(nav.getByRole("link")).toHaveText(["data-reveal", "Overview", "Showcase", ...types.map((type) => type.id), "GitHub", "npm"]);
    await expect(nav.getByRole("link", { name: "Showcase" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Showcase" }).locator('svg[data-icon="showcase"]')).toHaveCount(1);
  });

  test("lists each site with its screenshot and the types it uses", async ({ page }) => {
    await page.goto("/showcase-fixture/showcase/");
    const cards = page.locator("[data-showcase] > li");
    await expect(cards).toHaveCount(2);
    const first = cards.filter({ hasText: "Example site" });
    await expect(first.getByRole("link", { name: /Example site/ })).toHaveAttribute("href", "https://example.com/");
    await expect(first).toContainText("example.com");
    await expect(first).toContainText("A test entry");
    await expect(first.locator("img")).toHaveAttribute("width", /\d+/);
    expect(await first.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    const usedTypes = first.getByRole("list", { name: "Types used" });
    for (const id of ["fade", "split", "batch", "counter"]) await expect(usedTypes.locator(`svg[data-icon="${id}"]`)).toHaveCount(1);
    await expect(cards.filter({ hasText: "Another example" }).locator("img")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Add your site" })).toHaveAttribute(
      "href",
      /github\.com\/boccdotdev\/data-reveal\/issues\/new/,
    );
    // The rest of the site works under that base path too.
    await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "fade", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-example-state", "ready");
  });
});

test.describe("icons", () => {
  test("every type has its icon in the nav, the overview and its heading", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Site" });
    const index = page.getByRole("region", { name: "Types" });
    for (const { id } of types) {
      await expect(nav.getByRole("link", { name: id, exact: true }).locator(`svg[data-icon="${id}"]`)).toHaveCount(1);
      await expect(index.getByRole("link", { name: id, exact: true }).locator(`svg[data-icon="${id}"]`)).toHaveCount(1);
    }
    await openType(page, "/clip/");
    await expect(page.getByRole("heading", { level: 1 }).locator('svg[data-icon="clip"]')).toHaveCount(1);
  });
});
