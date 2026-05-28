import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { num } from "../internal/attrs.js";
import { revealTrigger } from "../internal/trigger.js";
import type { RevealInit, Direction } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

// Percent-based, so the element slides in from fully off its own box.
const directionMap: Record<Direction, { xPercent?: number; yPercent?: number }> = {
  up: { yPercent: 100 },
  down: { yPercent: -100 },
  left: { xPercent: 100 },
  right: { xPercent: -100 },
};

export const init: RevealInit = (el, { reduced }) => {
  if (reduced) {
    gsap.set(el, { opacity: 1, xPercent: 0, yPercent: 0 });
    return;
  }

  const direction = (el.dataset.revealDirection ?? "up") as Direction;
  const duration = num(el.dataset.revealDuration, 0.6);
  const delay = num(el.dataset.revealDelay, 0);

  const dir = directionMap[direction] ?? directionMap.up;
  gsap.set(el, {
    opacity: 0,
    xPercent: dir.xPercent ?? 0,
    yPercent: dir.yPercent ?? 0,
  });

  const tween = gsap.to(el, {
    opacity: 1,
    xPercent: 0,
    yPercent: 0,
    duration,
    delay,
    ease: "power3.out",
    scrollTrigger: revealTrigger(el),
  });

  registry.track(el, tween);
};
