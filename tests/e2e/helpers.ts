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

/** What a finished reveal could leave behind: computed transform, clip-path and filter. */
export function leftovers(target: Locator): Promise<{ transform: string; clipPath: string; filter: string }> {
  return target.evaluate((element) => {
    const style = getComputedStyle(element);
    return { transform: style.transform, clipPath: style.clipPath, filter: style.filter };
  });
}

export const nothingLeft = { transform: "none", clipPath: "none", filter: "none" };

/**
 * Waits until the window stops scrolling and returns where it stopped:
 * 300 ms without movement once it has moved, or 2 s if it never does (a
 * scroll stopped before it started). Timed rather than counted in frames, so
 * a busy machine doesn't cut it short.
 */
export async function scrollSettled(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const start = window.scrollY;
        let last = start;
        let since = performance.now();
        const check = (now: number) => {
          if (window.scrollY !== last) {
            last = window.scrollY;
            since = now;
          }
          if (now - since >= (last === start ? 2000 : 300)) resolve(last);
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }),
  );
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  inline: boolean;
}

/**
 * Scrolls the element into view and records its box each frame, relative to
 * its `.stage` (or the page), until its reveal has handed its inline
 * transform back and five more frames have passed. `inline` says whether a
 * transform was still set inline in that frame.
 */
export async function sampleReveal(page: Page, id: string): Promise<Box[]> {
  return page.evaluate(
    (id) =>
      new Promise<Box[]>((resolve) => {
        const element = document.getElementById(id) as HTMLElement;
        const stage = (element.closest(".stage") as HTMLElement | null) ?? document.body;
        const samples: Box[] = [];
        let after = 0;
        const sample = () => {
          const box = element.getBoundingClientRect();
          const origin = stage.getBoundingClientRect();
          const inline = element.style.transform !== "" || element.style.translate !== "";
          samples.push({ x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height, inline });
          if (samples.some((s) => s.inline) && !inline) after++;
          if (after >= 5 || samples.length > 600) resolve(samples);
          else requestAnimationFrame(sample);
        };
        element.scrollIntoView({ block: "center" });
        requestAnimationFrame(sample);
      }),
    id,
  );
}

/** The box of `#<id>-twin`, an unrevealed copy with the same CSS, relative to its `.stage`. */
export async function twinBox(page: Page, id: string): Promise<Omit<Box, "inline">> {
  return page.evaluate((id) => {
    const element = document.getElementById(`${id}-twin`) as HTMLElement;
    const box = element.getBoundingClientRect();
    const origin = (element.closest(".stage") as HTMLElement).getBoundingClientRect();
    return { x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height };
  }, id);
}

/** The largest change in position or size between the frame a reveal handed its transform back and the one before. */
export function jumpAtFinish(samples: Box[]): number {
  const handed = samples.findIndex((s, i) => i > 0 && samples[i - 1].inline && !s.inline);
  if (handed < 1) return Number.NaN;
  const [before, at] = [samples[handed - 1], samples[handed]];
  return Math.max(...(["x", "y", "width", "height"] as const).map((key) => Math.abs(at[key] - before[key])));
}

/** The element's top relative to the document, which moves only if something offsets it. */
export function documentTop(target: Locator): Promise<number> {
  return target.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
}

declare global {
  interface Window {
    __reveal: {
      instance: {
        init(container?: ParentNode): Promise<void>;
        refresh(): void;
        destroy(container?: ParentNode, options?: { revert?: boolean }): void;
      } | null;
      settled: boolean;
      result: string | null;
      refreshes: number;
    };
  }
}
