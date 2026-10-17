import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { unhide } from "../core/visibility.js";
import { revealCallbacks, revealedAtOnce } from "../internal/finish.js";
import { options } from "../internal/options.js";
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

export const init: RevealInit = (el, ctx) => {
  if (ctx.reduced) {
    unhide(el);
    revealedAtOnce(el, ctx);
    return;
  }

  const { direction, duration, delay, ease } = options(el, ctx, {
    direction: "up",
    duration: 0.7,
    delay: 0,
    ease: "power3.out",
  });

  gsap.set(el, { clipPath: fromClip[direction] ?? fromClip.up });
  unhide(el);

  const tween = gsap.to(el, {
    clipPath: "inset(0 0 0 0)",
    duration,
    delay,
    ease,
    scrollTrigger: revealTrigger(el, ctx),
    ...revealCallbacks(el, ctx),
  });

  registry.track(el, tween);
};

export const clip: RevealRegistration = { type: "clip", init };
