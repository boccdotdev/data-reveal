import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { shownOpacity, unhide } from "../core/visibility.js";
import { revealCallbacks, revealedAtOnce } from "../internal/finish.js";
import { options } from "../internal/options.js";
import { ownTransform } from "../internal/transform.js";
import { revealTrigger } from "../internal/trigger.js";
import type { RevealInit, Direction, RevealRegistration } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

// Percent-based, so the element slides in from fully off its own box.
const directionMap: Record<Direction, { xPercent?: number; yPercent?: number }> = {
  up: { yPercent: 100 },
  down: { yPercent: -100 },
  left: { xPercent: 100 },
  right: { xPercent: -100 },
};

export const init: RevealInit = (el, ctx) => {
  if (ctx.reduced) {
    unhide(el);
    revealedAtOnce(el, ctx);
    return;
  }

  const { direction, duration, delay, ease } = options(el, ctx, {
    direction: "up",
    duration: 0.6,
    delay: 0,
    ease: "power3.out",
  });

  const opacity = shownOpacity(el);
  const own = ownTransform(el);
  const dir = directionMap[direction] ?? directionMap.up;
  gsap.set(el, {
    opacity: 0,
    xPercent: own.xPercent + (dir.xPercent ?? 0),
    yPercent: own.yPercent + (dir.yPercent ?? 0),
  });

  const tween = gsap.to(el, {
    opacity,
    xPercent: own.xPercent,
    yPercent: own.yPercent,
    duration,
    delay,
    ease,
    scrollTrigger: revealTrigger(el, ctx),
    ...revealCallbacks(el, ctx),
  });

  registry.track(el, tween);
};

export const slide: RevealRegistration = { type: "slide", init };
