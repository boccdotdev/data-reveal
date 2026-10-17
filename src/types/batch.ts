import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { shownOpacity, unhide } from "../core/visibility.js";
import { revealCallbacks, revealed, revealedAtOnce } from "../internal/finish.js";
import { capOpacity } from "../internal/opacity.js";
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
    revealedAtOnce(el, ctx);
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
  // Callbacks per item, so each item hands its props back as soon as its own
  // reveal finishes. The batch is done once every item is.
  const cleanUp = cleansUp(el, ctx);
  const finished = new Set<HTMLElement>();
  const itemStagger = {
    each: stagger,
    ...revealCallbacks(el, ctx, {
      onDone: (item) => {
        finished.add(item);
        if (finished.size === targets.length) revealed(el, { release: cleanUp });
      },
    }),
  };
  // Every group's tween stays registered until it completes or is
  // interrupted, so destroy() stops each group still animating. A new group
  // takes its items over from this batch's own earlier tweens (they entered
  // or left again), but never from another reveal's tween on an item, which
  // GSAP's `overwrite` would kill: that one has to finish, so it's done.
  const running = new Set<gsap.core.Tween>();
  const forget = function (this: gsap.core.Tween): void {
    running.delete(this);
    registry.forget(el, this);
  };
  const play = (group: Element[], vars: gsap.TweenVars): void => {
    running.forEach((tween) => tween.kill(group));
    const tween = gsap.to(group, { ...vars, duration, onComplete: forget, onInterrupt: forget });
    running.add(tween);
    registry.track(el, tween);
  };

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
    onEnter: (group) =>
      play(group, {
        ...shown,
        modifiers: capOpacity((item) => opacities.get(item as HTMLElement) ?? 1),
        stagger: itemStagger,
        ease: ease ?? "back.out(1.4)",
      }),
    onLeaveBack: reverse
      ? (group) =>
          play(group, {
            ...hidden,
            stagger: { each: stagger, ...revealCallbacks(el, ctx, { cleanUp: false }) },
            ease: ease ?? "power2.in",
          })
      : undefined,
  });

  triggers.forEach((t) => registry.add(el, t));
};

export const batch: RevealRegistration = { type: "batch", init };
