import { str } from "./attrs.js";

const DEFAULT_START = "top 85%";

export function isReverse(el: HTMLElement): boolean {
  const value = el.dataset.revealReverse;
  return value != null && value !== "false";
}

export function revealStart(el: HTMLElement): string {
  return str(el.dataset.revealStart, DEFAULT_START);
}

export interface RevealTrigger {
  trigger: HTMLElement;
  start: string;
  once?: boolean;
  toggleActions?: string;
}

// With `data-reveal-reverse` the animation plays out again when scrolling
// back up past `start`; otherwise it plays once.
export function revealTrigger(el: HTMLElement): RevealTrigger {
  const start = revealStart(el);
  return isReverse(el)
    ? { trigger: el, start, toggleActions: "play none none reverse" }
    : { trigger: el, start, once: true };
}
