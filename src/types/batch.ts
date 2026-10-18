import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { pendingAttribute, setState } from "../core/state.js";
import { shownOpacity, unhide } from "../core/visibility.js";
import { markPending, revealCallbacks, revealed, revealedAtOnce } from "../internal/finish.js";
import { capOpacity } from "../internal/opacity.js";
import { option, options } from "../internal/options.js";
import { ownTransform, uncache } from "../internal/transform.js";
import { cleansUp, isReverse, revealStart } from "../internal/trigger.js";
import type { RevealInit, RevealRegistration } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

// Children that are never items when a batch falls back to its children:
// they don't render (an Alpine `<template x-for>`, say).
const notItems = "template, script, style, link, meta, noscript";

// Whether an item has a box to measure. One without (`display: none`, a 0×0
// carousel track, a closed <details>) would be placed wrongly: its trigger
// either fires at once, revealing it while it can't be seen, or never.
function measurable(item: Element): boolean {
  const visible = typeof item.checkVisibility === "function" ? item.checkVisibility() : item.getClientRects().length > 0;
  if (!visible) return false;
  const box = item.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}

export const init: RevealInit = (el, ctx) => {
  // The items: those marked data-reveal-item, or else the element's children.
  const marked = (): boolean => el.querySelector("[data-reveal-item]") !== null;
  const itemsNow = (): HTMLElement[] =>
    marked()
      ? Array.from(el.querySelectorAll<HTMLElement>("[data-reveal-item]"))
      : (Array.from(el.children).filter((child) => !child.matches(notItems)) as HTMLElement[]);

  if (ctx.reduced) {
    unhide(el);
    itemsNow().forEach(unhide);
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
  const cleanUp = cleansUp(el, ctx);

  // What the batch knows about its items. Only the items still to finish are
  // held strongly, so a finished batch doesn't keep removed items alive. The
  // batch is done once none are left.
  const armed = new WeakSet<HTMLElement>();
  const entered = new WeakSet<HTMLElement>();
  const unfinished = new Set<HTMLElement>();
  // Each item ends at its own opacity and position, read before it's hidden.
  const opacities = new WeakMap<HTMLElement, number>();
  const ownY = new WeakMap<HTMLElement, number>();
  const shown = {
    opacity: (_index: number, item: HTMLElement) => opacities.get(item) ?? 1,
    y: (_index: number, item: HTMLElement) => ownY.get(item) ?? 0,
  };
  const hidden = {
    opacity: 0,
    y: (_index: number, item: HTMLElement) => (ownY.get(item) ?? 0) + distance,
  };

  // Children the batch fell back to that had no box, watched in case they
  // get one before the batch is done (see watchOnceSized()).
  const loose = new Set<HTMLElement>();
  const done = (): void => {
    revealed(el, { release: cleanUp });
    // Too late to join now: they show as they are.
    loose.forEach((child) => observer?.unobserve(child));
    loose.clear();
  };
  const finishedOne = (item: HTMLElement): void => {
    unfinished.delete(item);
    item.removeAttribute(pendingAttribute);
    if (unfinished.size === 0) done();
  };
  // An item taken out of the page before it revealed won't, so it doesn't
  // hold the batch up. It's handed back as finish() would, so if it comes
  // back (a filter that detaches and re-attaches it) it shows as written.
  const dropRemoved = (): void => {
    loose.forEach((child) => {
      if (child.isConnected) return;
      observer?.unobserve(child);
      loose.delete(child);
    });
    const removed = Array.from(unfinished).filter((item) => !item.isConnected);
    if (removed.length === 0) return;
    removed.forEach((item) => {
      observer?.unobserve(item);
      unfinished.delete(item);
      running.forEach((tween) => tween.kill([item]));
      // Unless another reveal on it (a fade that started first) is still
      // animating it, and hands it back itself.
      if (!registry.animating(item)) {
        registry.restoreAnimated(item);
        uncache(item);
      }
      item.removeAttribute(pendingAttribute);
    });
    if (unfinished.size === 0 && !reverse) done();
  };

  // Callbacks per item, so each item hands its props back as soon as its own
  // reveal finishes.
  const itemStagger = {
    each: stagger,
    ...revealCallbacks(el, ctx, { onDone: finishedOne }),
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
    // What printing would put back is out of date for these now.
    atPrint = atPrint.filter(([item]) => !group.includes(item));
    const tween = gsap.to(group, { ...vars, duration, onComplete: forget, onInterrupt: forget });
    running.add(tween);
    registry.track(el, tween);
  };
  const enter = (group: Element[]): void => {
    // A play-once item enters once, even if printing already showed it.
    const fresh = reverse ? group : group.filter((item) => !entered.has(item as HTMLElement));
    if (fresh.length === 0) return;
    fresh.forEach((item) => entered.add(item as HTMLElement));
    play(fresh, {
      ...shown,
      modifiers: capOpacity((item) => opacities.get(item as HTMLElement) ?? 1),
      stagger: itemStagger,
      ease: ease ?? "back.out(1.4)",
    });
  };
  const leave = (group: Element[]): void =>
    play(group, {
      ...hidden,
      stagger: { each: stagger, ...revealCallbacks(el, ctx, { cleanUp: false, hides: true }) },
      ease: ease ?? "power2.in",
    });

  // One trigger per item, so a built-in start measures each item.
  const watch = (items: HTMLElement[]): void => {
    const triggers = ScrollTrigger.batch(items, {
      start: revealStart(el, ctx),
      once: !reverse,
      onEnter: enter,
      onLeaveBack: reverse ? leave : undefined,
    });
    triggers.forEach((t) => registry.add(el, t));
  };

  // Snapshots and hides items, which then count until they finish. A batch
  // that was done isn't any more (registry.rescan() reopens its entry).
  const prepare = (items: HTMLElement[]): void => {
    if (items.length === 0) return;
    if (el.getAttribute("data-reveal-state") === "done") setState(el, "ready");
    items.forEach((item) => {
      armed.add(item);
      unfinished.add(item);
      registry.snapshot(el, item);
      markPending(item);
    });
    items.forEach((item) => {
      opacities.set(item, shownOpacity(item));
      ownY.set(item, ownTransform(item).y);
    });
    gsap.set(items, hidden);
    registry.onPrint(el, printer);
  };

  // Items without a box wait until they get one (#9). A marked item waits
  // hidden and holds the batch up meanwhile. A child the batch falls back to
  // (a 0-height infinite-scroll sentinel, say) is left as it is and doesn't:
  // it joins the batch if it gets a box before the batch is done.
  let observer: ResizeObserver | undefined;
  const watchOnceSized = (items: HTMLElement[]): void => {
    if (!observer) {
      const current = (observer = new ResizeObserver((entries) => {
        dropRemoved();
        const sized = entries
          .map((entry) => entry.target as HTMLElement)
          .filter((item) => item.isConnected && measurable(item));
        sized.forEach((item) => {
          current.unobserve(item);
          loose.delete(item);
        });
        prepare(sized.filter((item) => !armed.has(item)));
        const waiting = sized.filter((item) => !entered.has(item));
        if (waiting.length > 0) watch(waiting);
      }));
      registry.add(el, {
        kill: () => {
          current.disconnect();
          if (observer === current) observer = undefined;
        },
      });
    }
    items.forEach((item) => observer?.observe(item));
  };

  // Arms items that aren't armed yet: all of them at first, then any added
  // since (#23). Returns whether it armed any.
  const arm = (items: HTMLElement[]): boolean => {
    const sized = items.filter(measurable);
    const unsized = items.filter((item) => !sized.includes(item));
    const now = marked() ? items : sized;
    prepare(now);
    if (sized.length > 0) watch(sized);
    if (now === sized) {
      // Children without a box only join a batch that isn't done.
      if (el.getAttribute("data-reveal-state") === "done") return now.length > 0;
      unsized.forEach((child) => loose.add(child));
    }
    if (unsized.length > 0) watchOnceSized(unsized);
    return now.length > 0;
  };

  // Printing shows every item at its end. A play-once batch plays the items
  // still waiting, then takes every group to its end, which finishes them as
  // usual. A reverse batch shows every item, without the pending mark the
  // print rules go by, and afterwards puts both back, so scrolling still
  // plays it.
  let atPrint: Array<[HTMLElement, number, number, boolean]> = [];
  let paused: gsap.core.Tween[] = [];
  const printer = {
    before: () => {
      if (reverse) {
        const items = Array.from(unfinished);
        paused = Array.from(running).filter((tween) => !tween.paused());
        paused.forEach((tween) => tween.pause());
        atPrint = items.map((item) => [
          item,
          Number(gsap.getProperty(item, "opacity")),
          Number(gsap.getProperty(item, "y")),
          item.hasAttribute(pendingAttribute),
        ]);
        gsap.set(items, shown);
        items.forEach((item) => item.removeAttribute(pendingAttribute));
        return;
      }
      enter(Array.from(unfinished));
      running.forEach((tween) => tween.progress(1));
    },
    after: () => {
      if (!reverse) return;
      atPrint.forEach(([item, opacity, y, pending]) => {
        gsap.set(item, { opacity, y });
        if (pending) markPending(item);
      });
      paused.forEach((tween) => tween.resume());
      atPrint = [];
      paused = [];
    },
  };

  unhide(el);
  arm(itemsNow());

  // Items added since, such as a load-more's, arm into this batch with its
  // settings when init() runs over it again. Those already shown stay as
  // they are.
  registry.onRescan(el, () => {
    dropRemoved();
    return arm(itemsNow().filter((item) => !armed.has(item)));
  });
};

export const batch: RevealRegistration = { type: "batch", init };
