import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { unhide } from "../core/visibility.js";
import { revealed, revealedAtOnce } from "../internal/finish.js";
import { option, options } from "../internal/options.js";
import { isReverse, revealTrigger } from "../internal/trigger.js";
import type { RevealInit, RevealRegistration } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

// The number in a piece of text, ignoring formatting such as separators.
const amount = (text: string): number => parseFloat(text.replace(/[^0-9.\-]/g, "")) || 0;

export const init: RevealInit = (el, ctx) => {
  const text = el.textContent ?? "";
  // Without a `to`, count up to the number the element already shows.
  const to = option(el, ctx, "to") ?? amount(text);
  const { from, duration, decimals, separator, prefix, suffix, ease } = options(el, ctx, {
    from: 0,
    duration: 1.5,
    decimals: 0,
    separator: "",
    prefix: "",
    suffix: "",
    ease: "power1.out",
  });

  const format = (value: number): string => {
    const fixed = value.toFixed(decimals);
    if (!separator) return `${prefix}${fixed}${suffix}`;
    const [intPart, decPart] = fixed.split(".");
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    return `${prefix}${decPart ? `${grouped}.${decPart}` : grouped}${suffix}`;
  };

  // destroy() leaves the number counted to: the element's own text if that
  // already shows it, in its own formatting, or else the formatted target,
  // rather than a placeholder like "0".
  registry.snapshot(el, el, { text: amount(text) === to ? text : format(to) });

  // The count is the animation, so the element itself shows straight away.
  unhide(el);

  if (ctx.reduced) {
    el.textContent = format(to);
    revealedAtOnce(el, ctx);
    return;
  }

  const counter = { value: from };
  el.textContent = format(from);

  const tween = gsap.to(counter, {
    value: to,
    duration,
    ease,
    onUpdate: () => {
      el.textContent = format(counter.value);
    },
    // The text it ends on is the text destroy() would leave, so a finished
    // count has nothing to undo.
    onComplete: isReverse(el, ctx) ? undefined : () => revealed(el, { release: true }),
    scrollTrigger: revealTrigger(el, ctx),
  });

  registry.track(el, tween);
};

export const counter: RevealRegistration = { type: "counter", init };
