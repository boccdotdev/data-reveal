import { prefersReducedMotion } from "./reducedMotion.js";
import { registry } from "./registry.js";
import { setState } from "./state.js";
import { unhide } from "./visibility.js";
import { parseOptions } from "../internal/options.js";
import type { RevealDefaults, RevealInit, RevealOptions, RevealType } from "../internal/types.js";

// Maps a `data-reveal` type string to its init, or null if the type isn't
// available. The auto entry resolves via dynamic import (async); the manual
// entry resolves via a static lookup (sync). Both are awaited uniformly.
export type RevealResolver = (
  type: string,
) => RevealInit | null | Promise<RevealInit | null>;

// ScrollTrigger.refresh() recalculates every trigger globally and forces a
// synchronous layout. Coalesce calls into one per frame so repeated init()
// (e.g. infinite scroll) doesn't thrash layout. Every call until that frame
// gets the same promise, which settles once the refresh has run.
//
// Safe mode: in GSAP 3.13 to 3.15, refresh(true) restarts a 0.2 s delayed
// call instead of refreshing at once, and that delayed refresh isn't forced,
// so if the page has scrolled in the last ~200 ms it waits for ScrollTrigger's
// "scrollEnd" event first. A plain refresh() runs straight away and moves the
// scroll position while it measures, which aborts a smooth scroll in flight
// (`scroll-behavior: smooth`, a scrollTo tween, Lenis). Safe mode needs
// ScrollTrigger to be set up, which it is once any trigger exists, and with
// no triggers there's nothing to refresh anyway, so the promise settles
// straight away.
let queuedRefresh: Promise<void> | undefined;
function scheduleRefresh(): Promise<void> {
  queuedRefresh ??= (async () => {
    try {
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          queuedRefresh = undefined;
          if (ScrollTrigger.getAll().length === 0) return resolve();
          // ScrollTrigger calls its listeners from an array, so removing one
          // while it does would skip the next.
          const refreshed = (): void => {
            resolve();
            queueMicrotask(() => ScrollTrigger.removeEventListener("refresh", refreshed));
          };
          ScrollTrigger.addEventListener("refresh", refreshed);
          ScrollTrigger.refresh(true);
        });
      });
    } catch {
      // ScrollTrigger didn't load (e.g. its chunk is gone after a deploy), so
      // nothing needs refreshing. Unqueue so a later call can try again.
      queuedRefresh = undefined;
    }
  })();
  return queuedRefresh;
}

// Which instance armed each element: that instance's current token, kept on
// the element under a global symbol rather than in this module, so every copy
// of the package on the page sees it (two separately bundled scripts each
// have their own module state and registry). Each destroy() only touches the
// elements its own token is on. A bare destroy() clears the token's `live`
// flag, which tells every copy those elements are free again. An element
// another live instance armed isn't armed again. Other copies, possibly other
// versions, read the token, so its shape has to stay `{ live: boolean }`.
type Token = { live: boolean };
const armedKey = Symbol.for("@boccdotdev/data-reveal.armedBy");
const marks = (el: Element) => el as unknown as Record<symbol, Token | undefined>;
const armedBy = (el: Element): Token | undefined => marks(el)[armedKey];

// destroy() takes (options), (container, options) or (undefined, options).
// A node from another realm (an iframe's document) isn't `instanceof Node`
// here, so go by `nodeType`. Anything else is a mistake, such as a jQuery
// object, and destroying the whole instance for it would be worse than
// saying so.
function destroyArguments(
  first: unknown,
  second: RevealDestroyOptions | undefined,
): { container?: ParentNode; options: RevealDestroyOptions } {
  if (first == null) return { options: second ?? {} };
  const nodeType = (first as Partial<Node>).nodeType;
  if (nodeType === 1 || nodeType === 9 || nodeType === 11) {
    return { container: first as ParentNode, options: second ?? {} };
  }
  const prototype: unknown = typeof first === "object" ? Object.getPrototypeOf(first) : undefined;
  if (prototype === null || (prototype !== undefined && Object.getPrototypeOf(prototype) === null)) {
    return { options: first as RevealDestroyOptions };
  }
  throw new TypeError(
    "destroy() takes an element, document or fragment to tear down, an options object, or both",
  );
}

// What one init() call knows about the elements it scanned.
interface Scan {
  // The call's claim token. An element whose claim is no longer this one was
  // destroyed, or taken over by a later init(), while its type loaded.
  claim: object;
  // Elements that were on the page when scanned. One that has left since was
  // removed while its type loaded. One that never was (init() on a detached
  // subtree that is about to be inserted) is armed as usual.
  connected: Set<Element>;
  reduced: boolean;
}

// Global defaults a type ignores, because the key means something else to it.
// A global `start` places a one-shot reveal's trigger, not a parallax range.
// A global `duration` sized for reveals would rush a count, and an
// overshooting ease would count past the target. `from` is a starting scale
// for `scale` but a starting number for `counter`. A global `stagger` is per
// item, not per character. These still apply when set in `typeDefaults` or
// as an attribute.
const globalsIgnored = new Map<string, Array<keyof RevealOptions>>([
  ["parallax", ["start", "end"]],
  ["counter", ["duration", "from", "ease"]],
  ["scale", ["from"]],
  ["split", ["stagger"]],
]);

/**
 * What `createReveal()` returns. Several instances can share a page (one per
 * script or bundle, say): each one's `destroy()` touches only the reveals it
 * armed itself.
 */
export interface RevealInstance {
  /**
   * Scan the container (and the container itself, if it has `data-reveal`)
   * for `[data-reveal]` elements, resolve only the animation types in use,
   * and run them. Async because type modules may load on demand. Each type
   * runs as soon as its module arrives. If a type fails to load, the other
   * types still run, the failed elements are left for a later call to try
   * again, and the promise rejects with the first error once every type has
   * settled. Only the elements this call claims are waited for: ones an
   * earlier, still-loading call claimed belong to that call.
   */
  init(container?: ParentNode): Promise<void>;
  /**
   * Recompute every ScrollTrigger's start/end positions. Call after a layout
   * change that ScrollTrigger can't detect on its own (e.g. toggling a grid's
   * column count, an accordion opening, late-loading fonts/images). Coalesced
   * to one refresh per frame. The promise resolves once the refresh has run,
   * about 200 ms later and after any scrolling has stopped, or straight away
   * when there's nothing to refresh.
   */
  refresh(): Promise<void>;
  /**
   * Tear down this instance's reveals. With no container, kills them all and
   * forgets every element so a later `init()` re-runs the whole page. With a
   * container, kills only reveals on or inside it and forgets just those
   * elements, so re-adding content there and calling `init()` re-animates
   * it. Elements an unfinished `init()` is still loading are dropped from
   * that call. Reveals another instance armed are left alone, as are ones
   * that have finished, which have already handed everything back.
   *
   * By default every element goes back to how it was before `init()`: the
   * props reveals animate (opacity, transforms, clip-path, filter), on the
   * element and on children the type styled, with any other inline styles
   * left as they are. A counter shows the number it counts to. Pass
   * `{ revert: false }` to leave the reveals' inline styles in place, e.g.
   * when the elements are about to be removed anyway.
   */
  destroy(options?: RevealDestroyOptions): void;
  destroy(container: ParentNode | undefined, options?: RevealDestroyOptions): void;
}

export interface RevealDestroyOptions {
  /** Put elements back as they were before `init()`. Default `true`. */
  revert?: boolean;
}

/**
 * Builds a RevealInstance around a type resolver. The auto and manual entries
 * differ only in how they resolve a type to its init — everything else (the
 * idempotent scan, option defaults, refresh coalescing, scoped teardown) is
 * shared here.
 */
export function createRevealCore(
  resolve: RevealResolver,
  { defaults, typeDefaults }: RevealDefaults = {},
): RevealInstance {
  // Elements already claimed by an init() call, so init() is safe to call
  // repeatedly as the DOM grows (e.g. infinite scroll) without re-animating
  // existing elements.
  let claims = new WeakMap<Element, object>();
  // This instance's mark on the elements it armed (see `armedKey`).
  let token: Token = { live: true };
  const owned = (el: Element): boolean => armedBy(el) === token;
  const unmark = (el: Element): void => {
    if (owned(el)) delete marks(el)[armedKey];
  };

  // Before printing, this instance's reveals show at their end, and
  // afterwards the ones that play again go back (#15). Listened for from the
  // first init() until a bare destroy().
  // A second `beforeprint` before `afterprint` is ignored, so what `after`
  // puts back is what was there before the first.
  let printing = false;
  const beforePrint = (): void => {
    if (printing) return;
    printing = true;
    registry.print(owned, "before");
  };
  const afterPrint = (): void => {
    if (!printing) return;
    printing = false;
    registry.print(owned, "after");
  };
  let listening = false;
  const listenForPrint = (): void => {
    if (listening || typeof window === "undefined") return;
    listening = true;
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
  };
  const stopListeningForPrint = (): void => {
    if (!listening) return;
    listening = false;
    window.removeEventListener("beforeprint", beforePrint);
    window.removeEventListener("afterprint", afterPrint);
  };

  // The defaults a type's init gets: its own typeDefaults over the global
  // ones it doesn't ignore, both read by the same rules as attributes, so an
  // unset or unreadable value doesn't hide the one below it.
  function defaultsFor(type: string): RevealOptions {
    const global = parseOptions(defaults);
    for (const key of globalsIgnored.get(type) ?? []) delete global[key];
    const own =
      typeDefaults && Object.prototype.hasOwnProperty.call(typeDefaults, type)
        ? typeDefaults[type as RevealType]
        : undefined;
    return { ...global, ...parseOptions(own) };
  }

  // Resolve one type and run it on its elements. Resolves with the errors
  // rather than rejecting, so init() can let every type settle first.
  async function arm(type: string, elements: HTMLElement[], scan: Scan): Promise<unknown[]> {
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
      unmark(el);
      setState(el, "failed");
      unhide(el);
    };

    const ctx = { reduced: scan.reduced, defaults: defaultsFor(type) };
    let armed = false;
    for (const el of elements) {
      // destroy() ran, or a later init() took the element over, meanwhile.
      if (claims.get(el) !== scan.claim) continue;
      if (scan.connected.has(el) && !el.isConnected) {
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
        if (!el.hasAttribute("data-reveal-state")) {
          setState(el, "skipped");
          unhide(el);
        }
        continue;
      }
      // Another instance with this type armed it first, so it's that one's.
      // Let go, so this instance can take it once that one destroys it.
      const owner = armedBy(el);
      if (owner?.live && owner !== token) {
        claims.delete(el);
        continue;
      }
      marks(el)[armedKey] = token;
      // Set first, so reveal.css lets go before the type looks at the
      // element's opacity.
      setState(el, "ready");
      // How the element looked before its type touched it, for destroy()
      // and for handing props back when a reveal finishes.
      registry.snapshot(el, el);
      try {
        init(el, ctx);
        armed = true;
      } catch (error) {
        errors.push(error);
        // Undo what the init got through before it threw: the tweens,
        // triggers and splits it registered for this element, and the whole
        // style attribute of the element and of anything else it
        // snapshotted. Nothing else can have changed them yet.
        registry.killElement(el, { restore: "style" });
        fail(el);
      }
    }

    if (armed) scheduleRefresh();
    return errors;
  }

  return {
    async init(container: ParentNode = document): Promise<void> {
      const found = Array.from(container.querySelectorAll<HTMLElement>("[data-reveal]"));
      if (container instanceof Element && container.matches("[data-reveal]")) {
        found.unshift(container as HTMLElement);
      }
      const scan: Scan = { claim: {}, connected: new Set(), reduced: prefersReducedMotion() };

      // Claim the unclaimed elements and group them by type, reading each
      // type once. Elements an earlier call claimed are that call's to arm.
      const groups = new Map<string, HTMLElement[]>();
      listenForPrint();
      let rescanned = false;
      for (const el of found) {
        // Armed by an earlier call: a batch may have new items to take on.
        if (claims.has(el)) {
          if (owned(el) && registry.rescan(el)) rescanned = true;
          continue;
        }
        claims.set(el, scan.claim);
        if (el.isConnected) scan.connected.add(el);
        const type = el.dataset.reveal ?? "";
        const group = groups.get(type);
        if (group) group.push(el);
        else groups.set(type, [el]);
      }

      if (rescanned) void scheduleRefresh();

      // Each type is armed as soon as it resolves, so one slow or failed
      // chunk doesn't hold back the rest.
      const errors = await Promise.all(
        Array.from(groups, ([type, elements]) => arm(type, elements, scan)),
      );
      // Every type has settled, so it's now safe to reject: callers' .catch()
      // still hears about the failure.
      const first = errors.find((typeErrors) => typeErrors.length > 0);
      if (first) throw first[0];
    },

    refresh(): Promise<void> {
      return scheduleRefresh();
    },

    destroy(first?: ParentNode | RevealDestroyOptions, second?: RevealDestroyOptions): void {
      const {
        container,
        options: { revert = true },
      } = destroyArguments(first, second);
      const restore = revert ? "animated" : "none";
      let killed: Element[];
      if (!container) {
        killed = registry.killAll({ restore, owned });
        claims = new WeakMap();
        token.live = false;
        token = { live: true };
        stopListeningForPrint();
      } else {
        killed = registry.kill(container, { restore, owned });
        // Forget every matching element so init() can re-animate it later.
        const found = Array.from(container.querySelectorAll("[data-reveal]"));
        if ((container as Node).nodeType === 1 && (container as Element).matches("[data-reveal]")) {
          found.push(container as Element);
        }
        for (const el of found) {
          claims.delete(el);
          unmark(el);
        }
      }
      // Back as it was, an element is still marked as handled, so reveal.css
      // leaves it alone, but a site's own pre-hide could hide it again.
      if (revert) killed.forEach((el) => unhide(el as HTMLElement));
    },
  };
}
