import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { shownOpacity, unhide } from "../core/visibility.js";
import { finishIfLast } from "../internal/finish.js";
import { options } from "../internal/options.js";
import { ownTransform } from "../internal/transform.js";
import { cleansUp, revealTrigger } from "../internal/trigger.js";
import type { RevealInit, RevealRegistration } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

export const init: RevealInit = (el, ctx) => {
  if (ctx.reduced) {
    unhide(el);
    return;
  }

  const { axis, rotate: amount, duration, delay, ease } = options(el, ctx, {
    axis: "x",
    rotate: 90,
    duration: 0.7,
    delay: 0,
    ease: "power3.out",
  });

  // Turn from the element's own angle plus `rotate`, back to its own angle,
  // around its own transform-origin.
  const opacity = shownOpacity(el);
  const own = ownTransform(el);
  const fromVars: Record<string, number> = { opacity: 0, transformPerspective: 800 };
  const toRotation: Record<string, number> = {};
  if (axis === "y") {
    fromVars.rotationY = own.rotationY + amount;
    toRotation.rotationY = own.rotationY;
  } else if (axis === "z") {
    fromVars.rotation = own.rotation + amount;
    toRotation.rotation = own.rotation;
  } else {
    fromVars.rotationX = own.rotationX - amount;
    toRotation.rotationX = own.rotationX;
  }

  gsap.set(el, fromVars);

  const tween = gsap.to(el, {
    opacity,
    ...toRotation,
    duration,
    delay,
    ease,
    scrollTrigger: revealTrigger(el, ctx),
    onComplete: cleansUp(el, ctx)
      ? function (this: gsap.core.Tween) {
          finishIfLast(this, el);
        }
      : undefined,
  });

  registry.track(el, tween);
};

export const rotate: RevealRegistration = { type: "rotate", init };
