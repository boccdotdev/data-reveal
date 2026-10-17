import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { shownOpacity, unhide } from "../core/visibility.js";
import { finishIfLast } from "../internal/finish.js";
import { option, options } from "../internal/options.js";
import { ownTransform } from "../internal/transform.js";
import { cleansUp, isReverse, revealStart } from "../internal/trigger.js";
import type { RevealInit, RevealRegistration } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

export const init: RevealInit = (el, ctx) => {
  const items = el.querySelectorAll<HTMLElement>("[data-reveal-item]");
  const targets: HTMLElement[] =
    items.length > 0 ? Array.from(items) : (Array.from(el.children) as HTMLElement[]);

  if (ctx.reduced) {
    unhide(el);
    targets.forEach(unhide);
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
  // Each item hands its props back as soon as its own reveal finishes.
  const itemStagger = cleansUp(el, ctx)
    ? {
        each: stagger,
        onComplete(this: gsap.core.Tween) {
          finishIfLast(this, this.targets()[0] as HTMLElement);
        },
      }
    : stagger;

  unhide(el);
  // Each item ends at its own opacity and position, read before it's hidden.
  targets.forEach((item) => registry.snapshot(el, item));
  const opacities = new Map(targets.map((item) => [item, shownOpacity(item)]));
  const ownY = new Map(targets.map((item) => [item, ownTransform(item).y]));
  const shown = {
    opacity: (_index: number, item: HTMLElement) => opacities.get(item) ?? 1,
    y: (_index: number, item: HTMLElement) => ownY.get(item) ?? 0,
  };
  const hidden = {
    opacity: 0,
    y: (_index: number, item: HTMLElement) => (ownY.get(item) ?? 0) + distance,
  };
  gsap.set(targets, hidden);

  // One trigger per item, so a built-in start measures each item.
  const triggers = ScrollTrigger.batch(targets, {
    start: revealStart(el, ctx),
    once: !reverse,
    onEnter: (group) => {
      gsap.to(group, {
        ...shown,
        duration,
        stagger: itemStagger,
        ease: ease ?? "back.out(1.4)",
        overwrite: true,
      });
    },
    onLeaveBack: reverse
      ? (group) => {
          gsap.to(group, {
            ...hidden,
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
