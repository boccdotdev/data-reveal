import { test as base, expect, type Locator, type Page } from "@playwright/test";

export { expect };

/** Every built-in type. Each has an element with that id in types.html. */
export const allTypes = [
  "fade",
  "scale",
  "split",
  "batch",
  "blur",
  "clip",
  "rotate",
  "slide",
  "counter",
  "parallax",
] as const;

export interface RevealTestOptions {
  /** The animation engine the fixture pages run on. Only "gsap" exists so far. */
  engine: string;
}

export interface Faults {
  fail?: string[];
  delay?: Record<string, number>;
  hang?: string[];
}

export interface FixtureOptions {
  /** Faults for every file the page loads whose name matches (see server.mjs). */
  faults?: Faults;
  /** Query parameters for head.js and harness.js. */
  params?: Record<string, string>;
}

type FixtureUrl = (name: string, options?: FixtureOptions) => string;

export const test = base.extend<RevealTestOptions & { fixtureUrl: FixtureUrl }>({
  engine: ["gsap", { option: true }],
  /** Builds the URL of a fixture page for the project's engine. */
  fixtureUrl: async ({ engine }, use) => {
    await use((name, { faults = {}, params = {} } = {}) => {
      const entries = [
        ...(faults.fail ?? []).map((file) => `fail=${file}`),
        ...Object.entries(faults.delay ?? {}).map(([file, ms]) => `delay=${file}:${ms}`),
        ...(faults.hang ?? []).map((file) => `hang=${file}`),
      ];
      const query = new URLSearchParams({ engine, ...params });
      return `/${entries.length > 0 ? entries.join(",") : "-"}/fixtures/${name}.html?${query}`;
    });
  },
});

/** Waits for the harness's init() to finish and returns how it ended. */
export async function initResult(page: Page): Promise<string> {
  await page.waitForFunction(() => window.__reveal?.settled === true);
  return page.evaluate(() => window.__reveal.result ?? "");
}

/** Waits until the harness has created the instance, without calling init(). */
export async function instanceReady(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__reveal?.instance != null);
}

/** Scrolls the element to the middle of the viewport, past any trigger start. */
export async function scrollTo(target: Locator): Promise<void> {
  await target.evaluate((element) => element.scrollIntoView({ block: "center" }));
}

/** Lets the page render two frames, enough for scroll-linked updates to land. */
export async function frames(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

export async function expectState(target: Locator, state: "ready" | "skipped" | "failed" | null): Promise<void> {
  if (state === null) await expect(target).not.toHaveAttribute("data-reveal-state");
  else await expect(target).toHaveAttribute("data-reveal-state", state);
}

/** Computed opacity of the element and every descendant. */
export function opacities(target: Locator): Promise<string[]> {
  return target.evaluate((element) =>
    [element, ...Array.from(element.querySelectorAll("*"))].map((node) => getComputedStyle(node).opacity),
  );
}

/** Whether the element's clip-path still hides part of it: not `none` and not all-zero insets. */
export function isClipped(target: Locator): Promise<boolean> {
  return target.evaluate((element) => {
    const clip = getComputedStyle(element).clipPath;
    if (clip === "none") return false;
    return (clip.match(/-?[\d.]+/g) ?? []).map(Number).some((value) => value !== 0);
  });
}

/** The element's top relative to the document, which moves only if something offsets it. */
export function documentTop(target: Locator): Promise<number> {
  return target.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
}

declare global {
  interface Window {
    __reveal: {
      instance: { init(container?: ParentNode): Promise<void> } | null;
      settled: boolean;
      result: string | null;
    };
  }
}
