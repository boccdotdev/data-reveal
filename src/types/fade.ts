import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { options } from "../internal/options.js";
import { revealTrigger } from "../internal/trigger.js";
import type { RevealInit, Direction, RevealRegistration } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

const directionMap: Record<Direction, { x?: number; y?: number }> = {
  up: { y: 1 },
  down: { y: -1 },
  left: { x: 1 },
  right: { x: -1 },
};

export const init: RevealInit = (el, ctx) => {
  if (ctx.reduced) {
    gsap.set(el, { opacity: 1 });
    return;
  }

  const { direction, distance, duration, delay, ease } = options(el, ctx, {
    direction: "up",
    distance: 20,
    duration: 0.5,
    delay: 0,
    ease: "back.out(1.4)",
  });

  const dir = directionMap[direction] ?? directionMap.up;
  gsap.set(el, {
    opacity: 0,
    x: (dir.x ?? 0) * distance,
    y: (dir.y ?? 0) * distance,
  });

  const tween = gsap.to(el, {
    opacity: 1,
    x: 0,
    y: 0,
    duration,
    delay,
    ease,
    scrollTrigger: revealTrigger(el, ctx),
  });

  registry.track(el, tween);
};

export const fade: RevealRegistration = { type: "fade", init };
