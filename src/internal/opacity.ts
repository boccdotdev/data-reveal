import { gsap } from "gsap";

// For types that don't animate the element's own opacity. The core sets
// `data-reveal-state` before a type's init runs, so `reveal.css` has already
// let go: if the element still computes to 0, another rule is hiding it (e.g.
// a site's own `[data-reveal] { opacity: 0 }`), so show it. Any other value
// is the element's own opacity and is left alone.
export function unhide(el: HTMLElement): void {
  if (getComputedStyle(el).opacity === "0") gsap.set(el, { opacity: 1 });
}
