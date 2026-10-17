import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { options } from "../internal/options.js";
import { revealTrigger } from "../internal/trigger.js";
import type { RevealInit, RevealRegistration } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

export const init: RevealInit = (el, ctx) => {
  if (ctx.reduced) {
    gsap.set(el, { opacity: 1, rotationX: 0, rotationY: 0, rotation: 0 });
    return;
  }

  const { axis, rotate: amount, duration, delay, ease } = options(el, ctx, {
    axis: "x",
    rotate: 90,
    duration: 0.7,
    delay: 0,
    ease: "power3.out",
  });

  const fromVars: Record<string, number> = { opacity: 0, transformPerspective: 800 };
  const toRotation: Record<string, number> = {};
  if (axis === "y") {
    fromVars.rotationY = amount;
    toRotation.rotationY = 0;
  } else if (axis === "z") {
    fromVars.rotation = amount;
    toRotation.rotation = 0;
  } else {
    fromVars.rotationX = -amount;
    toRotation.rotationX = 0;
  }

  gsap.set(el, { ...fromVars, transformOrigin: "center" });

  const tween = gsap.to(el, {
    opacity: 1,
    ...toRotation,
    duration,
    delay,
    ease,
    scrollTrigger: revealTrigger(el, ctx),
  });

  registry.track(el, tween);
};

export const rotate: RevealRegistration = { type: "rotate", init };
