import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { num } from "../internal/attrs.js";
import { isReverse, revealStart } from "../internal/trigger.js";
import type { RevealInit } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

export const init: RevealInit = (el, { reduced }) => {
  const items = el.querySelectorAll<HTMLElement>("[data-reveal-item]");
  const targets: HTMLElement[] =
    items.length > 0 ? Array.from(items) : (Array.from(el.children) as HTMLElement[]);

  if (reduced) {
    gsap.set([el, ...targets], { opacity: 1 });
    return;
  }

  const stagger = num(el.dataset.revealStagger, 0.06);
  const duration = num(el.dataset.revealDuration, 0.45);
  const distance = num(el.dataset.revealDistance, 20);
  const start = revealStart(el);
  const reverse = isReverse(el);

  gsap.set(el, { opacity: 1 });
  gsap.set(targets, { opacity: 0, y: distance });

  const triggers = ScrollTrigger.batch(targets, {
    start,
    once: !reverse,
    onEnter: (group) => {
      gsap.to(group, {
        opacity: 1,
        y: 0,
        duration,
        stagger,
        ease: "back.out(1.4)",
        overwrite: true,
      });
    },
    onLeaveBack: reverse
      ? (group) => {
          gsap.to(group, {
            opacity: 0,
            y: distance,
            duration,
            stagger,
            ease: "power2.in",
            overwrite: true,
          });
        }
      : undefined,
  });

  triggers.forEach((t) => registry.add(t));
};
