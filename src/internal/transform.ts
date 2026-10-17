import { gsap } from "gsap";
import { registry } from "../core/registry.js";

/** An element's transform as GSAP sees it. */
export interface OwnTransform {
  x: number;
  y: number;
  xPercent: number;
  yPercent: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  rotationX: number;
  rotationY: number;
}

// GSAP's getProperty() takes a fourth `uncache` argument its types leave out.
const getProperty = gsap.getProperty as (
  target: Element,
  property: string,
  unit?: string,
  uncache?: boolean,
) => string | number;

// Elements whose own CSS sets the individual `translate`, `rotate` or `scale`
// properties, as read before GSAP folded them into its cache.
const individual = new WeakSet<Element>();

/**
 * Makes GSAP read `el`'s transform from the page next time instead of from
 * its cache, if its own CSS sets the individual `translate`, `rotate` or
 * `scale` properties. Call it whenever transform props are handed back to
 * the CSS: GSAP folded those properties into its cache and wrote `none` for
 * them inline, so once they apply again a site's next tween on the element
 * would apply them twice. GSAP's own `clearProps` does the same. Without
 * them, the cache is left alone: re-reading from the matrix would turn a
 * site's own `rotation: 270` into -90 and send its next tween the long way
 * round.
 */
export function uncache(el: Element): void {
  const cache = (el as { _gsap?: { uncache?: number } })._gsap;
  if (cache && individual.has(el)) cache.uncache = 1;
}

// Notes whether `el`'s own CSS sets the individual transform properties,
// which is what uncache() checks. It has to be read before GSAP first reads
// the element: GSAP then writes `none` for them inline.
function watchTransform(el: HTMLElement): void {
  const style = getComputedStyle(el);
  const sets = ["translate", "rotate", "scale"].some((name) => {
    const value = style.getPropertyValue(name);
    return value !== "" && value !== "none";
  });
  if (sets) individual.add(el);
  else individual.delete(el);
}

// The transform the element's own CSS gives it: its `transform` plus the
// individual `translate`, `rotate` and `scale` properties (Tailwind v4's
// utilities use these), which GSAP folds into its transform when it reads the
// element. A reveal starts from these plus its offset and ends on them, so
// handing the props back to the CSS when it finishes doesn't move anything.
//
// On an element's first reveal, GSAP's own reading is used, cache and all:
// re-reading from the matrix would turn a site's own `rotation: 270` into
// -90 and send its next tween the long way round. The element is read
// afresh only when its styles might not be its own: an earlier reveal left
// values in GSAP's cache (a re-init), or another reveal on it has set a
// starting state. Then it's read as its snapshot recorded it, and that
// state is put back afterwards.
//
// When destroy() puts the element back, GSAP's cache has to match what the
// CSS then shows, or a site's next tween, or the next reveal to arm it,
// starts from the reveal's leftover offset. With the individual properties,
// uncache() makes GSAP read it again. Without them, the cache is set to the
// values read here, which keeps a site's own `rotation: 270`. Call it after
// the element is snapshotted (the core snapshots the element a reveal is on;
// batch snapshots its items).
export function ownTransform(el: HTMLElement): OwnTransform {
  const { rerun, shared } = registry.styledBefore(el);
  const fresh = rerun || shared;
  const style = el.getAttribute("style");
  if (shared) registry.restoreAnimated(el);
  watchTransform(el);
  const read = (property: string, uncache = false): number =>
    Number(getProperty(el, property, undefined, uncache));
  const own: OwnTransform = {
    x: read("x", fresh),
    y: read("y"),
    xPercent: read("xPercent"),
    yPercent: read("yPercent"),
    scaleX: read("scaleX"),
    scaleY: read("scaleY"),
    rotation: read("rotation"),
    rotationX: read("rotationX"),
    rotationY: read("rotationY"),
  };
  if (shared) {
    if (style === null) el.removeAttribute("style");
    else el.setAttribute("style", style);
    read("x", true);
  }
  registry.resetOnRestore(el, () => {
    if (individual.has(el)) uncache(el);
    else gsap.set(el, own);
  });
  return own;
}
