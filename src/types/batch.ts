import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { unhide } from "../core/visibility.js";
import { option, options } from "../internal/options.js";
import { isReverse, revealStart } from "../internal/trigger.js";
import type { RevealInit, RevealRegistration } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

export const init: RevealInit = (el, ctx) => {
  const items = el.querySelectorAll<HTMLElement>("[data-reveal-item]");
  const targets: HTMLElement[] =
    items.length > 0 ? Array.from(items) : (Array.from(el.children) as HTMLElement[]);

  if (ctx.reduced) {
    unhide(el);
    gsap.set(targets, { opacity: 1 });
    return;
  }

  const { stagger, duration, distance } = options(el, ctx, {
    stagger: 0.06,
    duration: 0.45,
    distance: 20,
  });
  // An ease from an attribute or the defaults applies both ways. The
  // built-in ones differ: an overshoot in, a plain ease out.
  const ease = option(el, ctx, "ease");
  const reverse = isReverse(el, ctx);

  unhide(el);
  gsap.set(targets, { opacity: 0, y: distance });

  // One trigger per item, so a built-in start measures each item.
  const triggers = ScrollTrigger.batch(targets, {
    start: revealStart(el, ctx),
    once: !reverse,
    onEnter: (group) => {
      gsap.to(group, {
        opacity: 1,
        y: 0,
        duration,
        stagger,
        ease: ease ?? "back.out(1.4)",
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
            ease: ease ?? "power2.in",
            overwrite: true,
          });
        }
      : undefined,
  });

  triggers.forEach((t) => registry.add(el, t));
};

export const batch: RevealRegistration = { type: "batch", init };
