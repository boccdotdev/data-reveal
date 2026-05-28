import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { num } from "../internal/attrs.js";
import { revealTrigger } from "../internal/trigger.js";
import type { RevealInit } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

export const init: RevealInit = (el, { reduced }) => {
  if (reduced) {
    gsap.set(el, { opacity: 1, scale: 1 });
    return;
  }

  const fromScale = num(el.dataset.revealFrom, 0.92);
  const duration = num(el.dataset.revealDuration, 0.5);
  const delay = num(el.dataset.revealDelay, 0);

  gsap.set(el, { opacity: 0, scale: fromScale });

  const tween = gsap.to(el, {
    opacity: 1,
    scale: 1,
    duration,
    delay,
    ease: "back.out(1.4)",
    scrollTrigger: revealTrigger(el),
  });

  registry.track(tween);
};
