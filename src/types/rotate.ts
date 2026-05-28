import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { num } from "../internal/attrs.js";
import { revealTrigger } from "../internal/trigger.js";
import type { RevealInit, Axis } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

export const init: RevealInit = (el, { reduced }) => {
  if (reduced) {
    gsap.set(el, { opacity: 1, rotationX: 0, rotationY: 0, rotation: 0 });
    return;
  }

  const axis = (el.dataset.revealAxis ?? "x") as Axis;
  const amount = num(el.dataset.revealRotate, 90);
  const duration = num(el.dataset.revealDuration, 0.7);
  const delay = num(el.dataset.revealDelay, 0);

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
    ease: "power3.out",
    scrollTrigger: revealTrigger(el),
  });

  registry.track(tween);
};
