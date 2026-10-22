import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { shownOpacity, unhide } from "../core/visibility.js";
import { markPending, printsAtEnd, revealCallbacks, revealedAtOnce } from "../internal/finish.js";
import { capOpacity } from "../internal/opacity.js";
import { options } from "../internal/options.js";
import { revealTrigger } from "../internal/trigger.js";
import type { RevealInit, RevealRegistration } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

export const init: RevealInit = (el, ctx) => {
  if (ctx.reduced) {
    unhide(el);
    revealedAtOnce(el, ctx);
    return;
  }

  const { blur: amount, duration, delay, ease } = options(el, ctx, {
    blur: 12,
    duration: 0.6,
    delay: 0,
    ease: "power2.out",
  });

  const opacity = shownOpacity(el);
  gsap.set(el, { opacity: 0, filter: `blur(${amount}px)` });

  markPending(el);
  const tween = gsap.to(el, {
    opacity,
    modifiers: capOpacity(opacity),
    filter: "blur(0px)",
    duration,
    delay,
    ease,
    scrollTrigger: revealTrigger(el, ctx),
    ...revealCallbacks(el, ctx),
  });

  registry.track(el, tween);
  printsAtEnd(el, ctx, () => tween);
};

export const blur: RevealRegistration = { type: "blur", init };
