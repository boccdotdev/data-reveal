import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { registry } from "../core/registry.js";
import { unhide } from "../core/visibility.js";
import { options } from "../internal/options.js";
import { revealTrigger } from "../internal/trigger.js";
import type { RevealInit, RevealRegistration } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger, SplitText);

export const init: RevealInit = (el, ctx) => {
  if (ctx.reduced) {
    unhide(el);
    return;
  }

  const { split: splitType, stagger, duration, delay, ease } = options(el, ctx, {
    split: "chars",
    stagger: 0.02,
    duration: 0.5,
    delay: 0,
    ease: "back.out(1.7)",
  });

  // Splitting words alongside chars wraps each char in an inline-block word,
  // so a word wraps as a unit instead of breaking between letters.
  const gsapType = splitType === "chars" ? "words, chars" : splitType;
  const split = SplitText.create(el, { type: gsapType });
  registry.addSplit(el, split);

  const targets = split[splitType];
  unhide(el);
  gsap.set(targets, { opacity: 0, yPercent: 60 });

  const tween = gsap.to(targets, {
    opacity: 1,
    yPercent: 0,
    duration,
    stagger,
    delay,
    ease,
    scrollTrigger: revealTrigger(el, ctx),
  });

  registry.track(el, tween);
};

export const split: RevealRegistration = { type: "split", init };
