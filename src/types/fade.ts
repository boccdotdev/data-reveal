import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { num } from "../internal/attrs.js";
import { revealTrigger } from "../internal/trigger.js";
import type { RevealInit, Direction } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

const directionMap: Record<Direction, { x?: number; y?: number }> = {
  up: { y: 1 },
  down: { y: -1 },
  left: { x: 1 },
  right: { x: -1 },
};

export const init: RevealInit = (el, { reduced }) => {
  if (reduced) {
    gsap.set(el, { opacity: 1 });
    return;
  }

  const direction = (el.dataset.revealDirection ?? "up") as Direction;
  const distance = num(el.dataset.revealDistance, 20);
  const duration = num(el.dataset.revealDuration, 0.5);
  const delay = num(el.dataset.revealDelay, 0);

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
    ease: "back.out(1.4)",
    scrollTrigger: revealTrigger(el),
  });

  registry.track(tween);
};
