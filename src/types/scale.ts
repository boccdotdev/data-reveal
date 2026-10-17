import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { options } from "../internal/options.js";
import { revealTrigger } from "../internal/trigger.js";
import type { RevealInit, RevealRegistration } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

export const init: RevealInit = (el, ctx) => {
  if (ctx.reduced) {
    gsap.set(el, { opacity: 1, scale: 1 });
    return;
  }

  const { from, duration, delay, ease } = options(el, ctx, {
    from: 0.92,
    duration: 0.5,
    delay: 0,
    ease: "back.out(1.4)",
  });

  gsap.set(el, { opacity: 0, scale: from });

  const tween = gsap.to(el, {
    opacity: 1,
    scale: 1,
    duration,
    delay,
    ease,
    scrollTrigger: revealTrigger(el, ctx),
  });

  registry.track(el, tween);
};

export const scale: RevealRegistration = { type: "scale", init };
