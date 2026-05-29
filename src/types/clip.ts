import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { num } from "../internal/attrs.js";
import { revealTrigger } from "../internal/trigger.js";
import type { RevealInit, Direction, RevealRegistration } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

// clip-path inset() wipe. The starting inset hides the element from the far
// edge; animating it to 0 wipes the content in along `direction`.
const fromClip: Record<Direction, string> = {
  right: "inset(0 100% 0 0)",
  left: "inset(0 0 0 100%)",
  down: "inset(0 0 100% 0)",
  up: "inset(100% 0 0 0)",
};

export const init: RevealInit = (el, { reduced }) => {
  if (reduced) {
    gsap.set(el, { clipPath: "inset(0 0 0 0)", opacity: 1 });
    return;
  }

  const direction = (el.dataset.revealDirection ?? "up") as Direction;
  const duration = num(el.dataset.revealDuration, 0.7);
  const delay = num(el.dataset.revealDelay, 0);

  gsap.set(el, { clipPath: fromClip[direction] ?? fromClip.up, opacity: 1 });

  const tween = gsap.to(el, {
    clipPath: "inset(0 0 0 0)",
    duration,
    delay,
    ease: "power3.out",
    scrollTrigger: revealTrigger(el),
  });

  registry.track(el, tween);
};

export const clip: RevealRegistration = { type: "clip", init };
