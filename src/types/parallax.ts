import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { num, str } from "../internal/attrs.js";
import type { RevealInit } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

// Continuous, scroll-linked motion — not a one-shot reveal. Movement is
// scrubbed across the scroll range, so it is already bidirectional and
// ignores `data-reveal-reverse`.
export const init: RevealInit = (el, { reduced }) => {
  if (reduced) return;

  const speed = num(el.dataset.revealSpeed, 0.3);
  const start = str(el.dataset.revealStart, "top bottom");
  const end = str(el.dataset.revealEnd, "bottom top");
  const distance = speed * 100;

  const tween = gsap.fromTo(
    el,
    { yPercent: -distance },
    {
      yPercent: distance,
      ease: "none",
      scrollTrigger: { trigger: el, start, end, scrub: true },
    },
  );

  registry.track(el, tween);
};
