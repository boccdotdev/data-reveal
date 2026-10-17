import type { ScrollTrigger } from "gsap/ScrollTrigger";
import { option } from "./options.js";
import type { RevealContext } from "./types.js";

// The scroller's visible box and scroll range, in the same terms whether it's
// the window or an element (`ScrollTrigger.defaults({ scroller })`).
function measure(scroller: Element | Window): { top: number; height: number; scroll: number; max: number } {
  if (scroller instanceof Element && scroller !== document.documentElement && scroller !== document.body) {
    return {
      top: scroller.getBoundingClientRect().top + scroller.clientTop,
      height: scroller.clientHeight,
      scroll: scroller.scrollTop,
      max: scroller.scrollHeight - scroller.clientHeight,
    };
  }
  const page = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  return { top: 0, height: window.innerHeight, scroll: window.scrollY, max: page - window.innerHeight };
}

// The built-in start, worked out each time ScrollTrigger refreshes.
// - Above the 85% line at load, "top 85%" lies before the top of the scroll
//   range, so the element plays straight away.
// - Below it, "top 85%" can lie past the end of the range, and an element near
//   the end would never play. clamp() pulls it back to the end. It isn't used
//   above the line, because it would also lift a start before the top to 0,
//   and ScrollTrigger doesn't count a trigger as entered at exactly its start:
//   content in view at load would wait for the first scroll.
// - If there's nothing to scroll, clamp() can't pull the start back below 0
//   either, so start when the element enters the viewport, which it already has.
// In 0.5 this end-of-page rule moves into each engine's observe() (#51).
export function defaultStart(self: ScrollTrigger): string {
  if (!self.trigger) return "top 85%";
  const scroller = measure(self.scroller);
  const top = self.trigger.getBoundingClientRect().top - scroller.top + scroller.scroll;
  if (top <= scroller.height * 0.85) return "top 85%";
  return scroller.max > 0 ? "clamp(top 85%)" : "top bottom";
}

export interface RevealTrigger {
  trigger: HTMLElement;
  start: string | ((self: ScrollTrigger) => string);
  once?: boolean;
  toggleActions?: string;
}

/** The trigger's start: from an attribute or the defaults exactly as given, else the built-in one. */
export function revealStart(el: HTMLElement, ctx: RevealContext): RevealTrigger["start"] {
  return option(el, ctx, "start") ?? defaultStart;
}

/** Whether the animation plays out again when scrolling back up past `start`. */
export function isReverse(el: HTMLElement, ctx: RevealContext): boolean {
  return option(el, ctx, "reverse") ?? false;
}

// With `reverse` the animation plays out again when scrolling back up past
// `start`; otherwise it plays once.
export function revealTrigger(el: HTMLElement, ctx: RevealContext): RevealTrigger {
  const start = revealStart(el, ctx);
  return isReverse(el, ctx)
    ? { trigger: el, start, toggleActions: "play none none reverse" }
    : { trigger: el, start, once: true };
}
