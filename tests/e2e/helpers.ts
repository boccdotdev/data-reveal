import { expect, type Locator, type Page } from "@playwright/test";

export interface Faults {
  fail?: string[];
  delay?: Record<string, number>;
  hang?: string[];
}

/**
 * The URL of a fixture page. Faults apply to every file the page loads whose
 * name matches (see server.mjs). REVEAL_ENGINE picks the engine, for when
 * there is more than one.
 */
export function fixture(
  name: string,
  { faults = {}, params = {} }: { faults?: Faults; params?: Record<string, string> } = {},
): string {
  const entries = [
    ...(faults.fail ?? []).map((file) => `fail=${file}`),
    ...Object.entries(faults.delay ?? {}).map(([file, ms]) => `delay=${file}:${ms}`),
    ...(faults.hang ?? []).map((file) => `hang=${file}`),
  ];
  const query = new URLSearchParams(params);
  if (process.env.REVEAL_ENGINE) query.set("engine", process.env.REVEAL_ENGINE);
  const search = query.toString();
  return `/${entries.length > 0 ? entries.join(",") : "-"}/fixtures/${name}.html${search ? `?${search}` : ""}`;
}

/** Waits for the harness's init() to finish and returns how it ended. */
export async function initResult(page: Page): Promise<string> {
  await page.waitForFunction(() => window.__reveal?.settled === true);
  return page.evaluate(() => window.__reveal.result ?? "");
}

/** Scrolls the element to the middle of the viewport, past any trigger start. */
export async function scrollTo(target: Locator): Promise<void> {
  await target.evaluate((element) => element.scrollIntoView({ block: "center" }));
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

/** The numbers in the element's computed `clip-path: inset(...)`. */
export function clipInsets(target: Locator): Promise<number[]> {
  return target.evaluate((element) =>
    (getComputedStyle(element).clipPath.match(/-?[\d.]+/g) ?? []).map(Number),
  );
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
