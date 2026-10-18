// The site's one reveal instance, on the engine this page runs. Across page
// changes it follows the README's recipe for Astro view transitions: before
// the swap, each reveal leaving the page is destroyed (persisted elements
// keep theirs), and after it, init() takes on the new page.
//
// A type whose chunk fails to load makes init() reject. The package has
// already shown the element as written by then (`data-reveal-state="failed"`),
// so the rejection is logged here and the page carries on: the settings,
// tabs and code don't depend on the reveal.
import type { RevealInstance } from "@boccdotdev/data-reveal";
import { chosenEngine } from "../lib/engine-choice";

export const engine = chosenEngine();

/** Logs a reveal that couldn't load or arm, without stopping the page. */
export function logFailure(error: unknown): void {
  console.warn("data-reveal:", error);
}

async function create(): Promise<RevealInstance | undefined> {
  try {
    return engine.load ? (await engine.load()).createReveal() : undefined;
  } catch (error) {
    logFailure(error);
    return undefined;
  }
}

const instance = await create();

if (instance) {
  const reveal = instance;
  document.addEventListener("astro:before-swap", () => {
    for (const el of document.querySelectorAll("[data-reveal]")) {
      // Persisted elements stay, and keep their reveals.
      if (!el.closest("[data-astro-transition-persist]")) reveal.destroy(el, { revert: false });
    }
  });
  document.addEventListener("astro:after-swap", () => reveal.init().catch(logFailure));
  await reveal.init().catch(logFailure);
}

// With `?test` in the URL, the tests can count the engine's live triggers.
if (new URLSearchParams(location.search).has("test") && engine.inspect) {
  (window as Window & { __engine?: unknown }).__engine = await engine.inspect().catch(() => undefined);
}

export const reveal = instance;
