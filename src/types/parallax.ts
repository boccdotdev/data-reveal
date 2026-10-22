import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { unhide } from "../core/visibility.js";
import { options } from "../internal/options.js";
import { ownTransform } from "../internal/transform.js";
import type { RevealInit, RevealRegistration } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

// Continuous, scroll-linked motion — not a one-shot reveal. Movement is
// scrubbed across the scroll range, so it is already bidirectional and
// ignores `reverse`, and it moves in step with the scroll, so it ignores
// `ease` too. Its start isn't clamped: the range should run from entering the
// viewport to leaving it.
export const init: RevealInit = (el, ctx) => {
  unhide(el);
  if (ctx.reduced) return;

  const { speed, start, end } = options(el, ctx, {
    speed: 0.3,
    start: "top bottom",
    end: "bottom top",
  });
  const distance = speed * 100;

  // Not for its values: so destroy() leaves GSAP reading the element right.
  ownTransform(el);
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

export const parallax: RevealRegistration = { type: "parallax", init };
