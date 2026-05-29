import { prefersReducedMotion } from "./reducedMotion.js";
import { registry } from "./registry.js";
import type { RevealInit } from "../internal/types.js";

// Maps a `data-reveal` type string to its init, or null if the type isn't
// available. The auto entry resolves via dynamic import (async); the manual
// entry resolves via a static lookup (sync). Both are awaited uniformly.
export type RevealResolver = (
  type: string,
) => RevealInit | null | Promise<RevealInit | null>;

// ScrollTrigger.refresh() recalculates every trigger globally and forces a
// synchronous layout. Coalesce calls into one per frame so repeated init()
// (e.g. infinite scroll) doesn't thrash layout.
let refreshQueued = false;
async function scheduleRefresh(): Promise<void> {
  if (refreshQueued) return;
  refreshQueued = true;
  const { ScrollTrigger } = await import("gsap/ScrollTrigger");
  requestAnimationFrame(() => {
    refreshQueued = false;
    ScrollTrigger.refresh();
  });
}

export interface RevealInstance {
  /**
   * Scan the container for `[data-reveal]` elements, resolve only the animation
   * types in use, and run them. Async because type modules may load on demand.
   */
  init(container?: ParentNode): Promise<void>;
  /**
   * Recompute every ScrollTrigger's start/end positions. Call after a layout
   * change that ScrollTrigger can't detect on its own (e.g. toggling a grid's
   * column count, an accordion opening, late-loading fonts/images). Coalesced
   * to one refresh per frame.
   */
  refresh(): void;
  /**
   * Tear down reveals. With no argument, kills everything and forgets all
   * elements so a later `init()` re-runs the whole page. With a container,
   * kills only reveals on or inside it and forgets just those elements, so
   * re-adding content there and calling `init()` re-animates it.
   */
  destroy(container?: ParentNode): void;
}

/**
 * Builds a RevealInstance around a type resolver. The auto and manual entries
 * differ only in how they resolve a type to its init — everything else (the
 * idempotent scan, refresh coalescing, scoped teardown) is shared here.
 */
export function createRevealCore(resolve: RevealResolver): RevealInstance {
  // Elements already initialized, so init() is safe to call repeatedly as the
  // DOM grows (e.g. infinite scroll) without re-animating existing elements.
  let seen = new WeakSet<Element>();

  return {
    async init(container: ParentNode = document): Promise<void> {
      const reduced = prefersReducedMotion();
      const elements = Array.from(
        container.querySelectorAll<HTMLElement>("[data-reveal]"),
      ).filter((el) => !seen.has(el));
      if (elements.length === 0) return;
      elements.forEach((el) => seen.add(el));

      const present = new Set<string>();
      for (const el of elements) {
        if (el.dataset.reveal) present.add(el.dataset.reveal);
      }

      const loaded = await Promise.all(
        Array.from(present).map(async (type) => {
          const init = await resolve(type);
          return init ? ([type, init] as const) : null;
        }),
      );

      const typeMap = new Map(
        loaded.filter((entry): entry is NonNullable<typeof entry> => entry !== null),
      );

      for (const el of elements) {
        const init = typeMap.get(el.dataset.reveal ?? "");
        if (init) init(el, { reduced });
      }

      scheduleRefresh();
    },

    refresh(): void {
      scheduleRefresh();
    },

    destroy(container?: ParentNode): void {
      if (!container) {
        registry.killAll();
        seen = new WeakSet();
        return;
      }
      // Forget every matching element so init() can re-animate it later.
      container.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => seen.delete(el));
      if (container instanceof Element && container.matches("[data-reveal]")) {
        seen.delete(container);
      }
      registry.kill(container);
    },
  };
}
