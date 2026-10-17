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
  try {
    const { ScrollTrigger } = await import("gsap/ScrollTrigger");
    requestAnimationFrame(() => {
      refreshQueued = false;
      ScrollTrigger.refresh();
    });
  } catch {
    // ScrollTrigger didn't load (e.g. its chunk is gone after a deploy), so
    // nothing needs refreshing. Unqueue so a later call can try again.
    refreshQueued = false;
  }
}

// init() sets `data-reveal-state` on every element it handles, whatever the
// outcome, so the pre-hide CSS (`reveal.css`) stops hiding it. "ready": its
// type took over. "skipped": no type is registered under that name.
// "failed": the type's module failed to load or its init threw.
type RevealState = "ready" | "skipped" | "failed";

function setState(el: HTMLElement, state: RevealState): void {
  el.setAttribute("data-reveal-state", state);
}

// Each init() call claims its elements, one claim per type. A claim that is
// no longer the element's current one means destroy() ran (or a later init()
// took the element over) while the type was loading, so the call leaves that
// element alone. `settled` lets another init() wait for elements this one is
// still loading instead of returning before they're armed.
interface Claim {
  settled: Promise<unknown[]>;
}

export interface RevealInstance {
  /**
   * Scan the container (and the container itself, if it has `data-reveal`)
   * for `[data-reveal]` elements, resolve only the animation types in use,
   * and run them. Async because type modules may load on demand. Each type
   * runs as soon as its module arrives. If a type fails to load, the other
   * types still run, the failed elements are left for a later call to try
   * again, and the promise rejects with the first error once every type has
   * settled.
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
   * re-adding content there and calling `init()` re-animates it. Elements an
   * unfinished `init()` is still loading are dropped from that call.
   */
  destroy(container?: ParentNode): void;
}

/**
 * Builds a RevealInstance around a type resolver. The auto and manual entries
 * differ only in how they resolve a type to its init — everything else (the
 * idempotent scan, refresh coalescing, scoped teardown) is shared here.
 */
export function createRevealCore(resolve: RevealResolver): RevealInstance {
  // Elements already claimed by an init() call, so init() is safe to call
  // repeatedly as the DOM grows (e.g. infinite scroll) without re-animating
  // existing elements.
  let claims = new WeakMap<Element, Claim>();

  // Resolve one type and run it on its elements. Resolves with the errors
  // rather than rejecting, so init() can let every type settle first.
  async function arm(
    type: string,
    elements: HTMLElement[],
    claim: Claim,
    reduced: boolean,
  ): Promise<unknown[]> {
    const errors: unknown[] = [];
    let init: RevealInit | null = null;
    let loaded = true;
    try {
      init = type ? await resolve(type) : null;
    } catch (error) {
      errors.push(error);
      loaded = false;
    }

    // Release the element so a later init() can try it again.
    const fail = (el: HTMLElement): void => {
      claims.delete(el);
      setState(el, "failed");
    };

    let armed = false;
    for (const el of elements) {
      // destroy() ran, or a later init() took the element over, meanwhile.
      if (claims.get(el) !== claim) continue;
      if (!el.isConnected) {
        claims.delete(el);
        continue;
      }
      if (!loaded) {
        fail(el);
        continue;
      }
      if (!init) {
        // Another instance may have this type registered and already be
        // handling the element, so don't overwrite its state.
        if (!el.hasAttribute("data-reveal-state")) setState(el, "skipped");
        continue;
      }
      // Set first, so reveal.css lets go before the type looks at the
      // element's opacity.
      setState(el, "ready");
      const style = el.getAttribute("style");
      try {
        init(el, { reduced });
        armed = true;
      } catch (error) {
        errors.push(error);
        // Undo whatever the init got through before it threw: its tweens,
        // triggers and splits, and the inline styles it set.
        registry.killElement(el);
        if (style === null) el.removeAttribute("style");
        else el.setAttribute("style", style);
        fail(el);
      }
    }

    if (armed) scheduleRefresh();
    return errors;
  }

  return {
    async init(container: ParentNode = document): Promise<void> {
      const reduced = prefersReducedMotion();
      const found = Array.from(container.querySelectorAll<HTMLElement>("[data-reveal]"));
      if (container instanceof Element && container.matches("[data-reveal]")) {
        found.unshift(container as HTMLElement);
      }

      // Group the unclaimed elements by type, reading each type once. An
      // element an earlier call is still loading is waited on, not re-armed.
      const groups = new Map<string, HTMLElement[]>();
      const pending = new Set<Promise<unknown>>();
      for (const el of found) {
        const claim = claims.get(el);
        if (claim) {
          pending.add(claim.settled);
          continue;
        }
        const type = el.dataset.reveal ?? "";
        const group = groups.get(type);
        if (group) group.push(el);
        else groups.set(type, [el]);
      }

      // Each type is armed as soon as it resolves, so one slow or failed
      // chunk doesn't hold back the rest.
      const settling = Array.from(groups, ([type, elements]) => {
        const claim = {} as Claim;
        elements.forEach((el) => claims.set(el, claim));
        claim.settled = arm(type, elements, claim, reduced);
        return claim.settled;
      });

      const [errors] = await Promise.all([Promise.all(settling), Promise.all(pending)]);
      // Every type has settled, so it's now safe to reject: callers' .catch()
      // still hears about the failure.
      const first = errors.find((typeErrors) => typeErrors.length > 0);
      if (first) throw first[0];
    },

    refresh(): void {
      scheduleRefresh();
    },

    destroy(container?: ParentNode): void {
      if (!container) {
        registry.killAll();
        claims = new WeakMap();
        return;
      }
      // Forget every matching element so init() can re-animate it later.
      container.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => claims.delete(el));
      if (container instanceof Element && container.matches("[data-reveal]")) {
        claims.delete(container);
      }
      registry.kill(container);
    },
  };
}
