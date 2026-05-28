import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { registry } from "../core/registry.js";
import { num } from "../internal/attrs.js";
import { revealTrigger } from "../internal/trigger.js";
import type { RevealInit, SplitType } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger, SplitText);

export const init: RevealInit = (el, { reduced }) => {
  if (reduced) {
    gsap.set(el, { opacity: 1 });
    return;
  }

  const splitType = (el.dataset.revealSplit ?? "chars") as SplitType;
  const stagger = num(el.dataset.revealStagger, 0.02);
  const duration = num(el.dataset.revealDuration, 0.5);
  const delay = num(el.dataset.revealDelay, 0);

  const split = SplitText.create(el, { type: splitType });
  registry.addSplit(el, split);

  const targets = split[splitType];
  gsap.set(el, { opacity: 1 });
  gsap.set(targets, { opacity: 0, yPercent: 60 });

  const tween = gsap.to(targets, {
    opacity: 1,
    yPercent: 0,
    duration,
    stagger,
    delay,
    ease: "back.out(1.7)",
    scrollTrigger: revealTrigger(el),
  });

  registry.track(el, tween);
};
