import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { unhide } from "../core/visibility.js";
import { option, options } from "../internal/options.js";
import { revealTrigger } from "../internal/trigger.js";
import type { RevealInit, RevealRegistration } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

export const init: RevealInit = (el, ctx) => {
  // Without a `to`, count up to the number the element already shows.
  const to = option(el, ctx, "to") ?? (parseFloat((el.textContent ?? "").replace(/[^0-9.\-]/g, "")) || 0);
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

  // The count is the animation, so the element itself shows straight away.
  unhide(el);

  if (ctx.reduced) {
    el.textContent = format(to);
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
    scrollTrigger: revealTrigger(el, ctx),
  });

  registry.track(el, tween);
};

export const counter: RevealRegistration = { type: "counter", init };
