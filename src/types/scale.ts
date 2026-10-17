import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { shownOpacity, unhide } from "../core/visibility.js";
import { revealCallbacks } from "../internal/finish.js";
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

  const { from, duration, delay, ease } = options(el, ctx, {
    from: 0.92,
    duration: 0.5,
    delay: 0,
    ease: "back.out(1.4)",
  });

  const opacity = shownOpacity(el);
  // `from` is relative to the element's own scale.
  const own = ownTransform(el);
  gsap.set(el, { opacity: 0, scaleX: own.scaleX * from, scaleY: own.scaleY * from });

  const tween = gsap.to(el, {
    opacity,
    scaleX: own.scaleX,
    scaleY: own.scaleY,
    duration,
    delay,
    ease,
    scrollTrigger: revealTrigger(el, ctx),
    ...revealCallbacks(el, { cleanUp: cleansUp(el, ctx) }),
  });

  registry.track(el, tween);
};

export const scale: RevealRegistration = { type: "scale", init };
