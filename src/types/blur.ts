import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { options } from "../internal/options.js";
import { revealTrigger } from "../internal/trigger.js";
import type { RevealInit, RevealRegistration } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

export const init: RevealInit = (el, ctx) => {
  if (ctx.reduced) {
    gsap.set(el, { opacity: 1, filter: "blur(0px)" });
    return;
  }

  const { blur: amount, duration, delay, ease } = options(el, ctx, {
    blur: 12,
    duration: 0.6,
    delay: 0,
    ease: "power2.out",
  });

  gsap.set(el, { opacity: 0, filter: `blur(${amount}px)` });

  const tween = gsap.to(el, {
    opacity: 1,
    filter: "blur(0px)",
    duration,
    delay,
    ease,
    scrollTrigger: revealTrigger(el, ctx),
  });

  registry.track(el, tween);
};

export const blur: RevealRegistration = { type: "blur", init };
