import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { num } from "../internal/attrs.js";
import { revealTrigger } from "../internal/trigger.js";
import type { RevealInit } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

export const init: RevealInit = (el, { reduced }) => {
  if (reduced) {
    gsap.set(el, { opacity: 1, filter: "blur(0px)" });
    return;
  }

  const amount = num(el.dataset.revealBlur, 12);
  const duration = num(el.dataset.revealDuration, 0.6);
  const delay = num(el.dataset.revealDelay, 0);

  gsap.set(el, { opacity: 0, filter: `blur(${amount}px)` });

  const tween = gsap.to(el, {
    opacity: 1,
    filter: "blur(0px)",
    duration,
    delay,
    ease: "power2.out",
    scrollTrigger: revealTrigger(el),
  });

  registry.track(tween);
};
