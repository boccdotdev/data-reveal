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

// The transform the element's own CSS gives it: its `transform` plus the
// individual `translate`, `rotate` and `scale` properties (Tailwind v4's
// utilities use these), which GSAP folds into its transform when it reads the
// element. A reveal starts from these plus its offset and ends on them, so
// handing the props back to the CSS when it finishes doesn't move anything.
//
// Another reveal on the same element may already have set its starting
// state, so read the element as its snapshot recorded it, then put that state
// back and let GSAP read it again.
// GSAP's getProperty() takes a fourth `uncache` argument its types leave out.
const getProperty = gsap.getProperty as (
  target: Element,
  property: string,
  unit?: string,
  uncache?: boolean,
) => string | number;

export function ownTransform(el: HTMLElement): OwnTransform {
  const style = el.getAttribute("style");
  registry.restoreAnimated(el);
  // `uncache` makes GSAP read the element afresh, not a value it cached
  // during an earlier run.
  const read = (property: string, uncache = false): number =>
    Number(getProperty(el, property, undefined, uncache));
  const own: OwnTransform = {
    x: read("x", true),
    y: read("y"),
    xPercent: read("xPercent"),
    yPercent: read("yPercent"),
    scaleX: read("scaleX"),
    scaleY: read("scaleY"),
    rotation: read("rotation"),
    rotationX: read("rotationX"),
    rotationY: read("rotationY"),
  };
  if (style === null) el.removeAttribute("style");
  else el.setAttribute("style", style);
  read("x", true);
  return own;
}
