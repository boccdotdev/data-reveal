import type { gsap } from "gsap";
import { registry } from "../core/registry.js";
import { pendingAttribute, setState } from "../core/state.js";
import { finish } from "../core/visibility.js";
import { uncache } from "./transform.js";
import { cleansUp, isReverse } from "./trigger.js";
import type { RevealContext } from "./types.js";

type Callback = (this: gsap.core.Tween) => void;

/**
 * Marks the play-once reveal on `el` as finished for good
 * (`data-reveal-state="done"`). If it handed its props back (`release`),
 * nothing is left for `destroy()` to undo, so the registry lets it go. With
 * `keep` it stays, so `destroy()` can still put the element back.
 */
export function revealed(el: HTMLElement, { release }: { release: boolean }): void {
  setState(el, "done");
  el.removeAttribute(pendingAttribute);
  if (release) registry.release(el);
  else registry.finished(el);
}

/**
 * Marks `target` as not at its end yet (`data-reveal-pending`), for
 * reveal.css's print rules. A play-once reveal stays marked until revealed().
 * revealCallbacks() takes a reverse one's mark off each time it has played in
 * and puts it back each time it has played out.
 */
export function markPending(target: HTMLElement): void {
  target.setAttribute(pendingAttribute, "");
}

/**
 * Lets the reveal on `el` print at its end: before printing, its tween (the
 * current one, for a split that re-splits) jumps to its end. A play-once
 * reveal then finishes as usual, handing its styles back. A reverse one goes
 * back afterwards to where it was, so scrolling still plays it.
 */
export function printsAtEnd(el: HTMLElement, ctx: RevealContext, tween: () => gsap.core.Tween | undefined): void {
  const reverse = isReverse(el, ctx);
  let progress: number | undefined;
  registry.onPrint(el, {
    before() {
      const current = tween();
      progress = undefined;
      // Killed partway (a site's `gsap.killTweensOf()`): leave it as the site
      // left it. Its pending mark still lets the print rules show it.
      if (!current || (!current.parent && current.progress() < 1)) return;
      progress = current.progress();
      current.progress(1);
    },
    after() {
      if (reverse && progress !== undefined) tween()?.progress(progress);
    },
  });
}

/**
 * Under reduced motion a play-once reveal is at its end state as soon as it's
 * armed, with nothing inline to undo.
 */
export function revealedAtOnce(el: HTMLElement, ctx: RevealContext): void {
  if (!isReverse(el, ctx)) revealed(el, { release: true });
}

/**
 * Callbacks for a reveal tween, to spread into its vars (or a stagger
 * object's, for one set per item). They tell the registry while the reveal on
 * `el` is animating its target, and when the tween completes they hand the
 * target's animated props back to its CSS if `cleanUp` asks for it (by
 * default unless `reverse` or `keep`). The target is `target`, or else the
 * tween's own target. `onFinish` replaces `finish()`, for a type with more to
 * undo. Then, unless `reverse` plays it again, `onDone` runs: by default it
 * marks `el` done with revealed().
 *
 * Two reveals on one element (a batch item that is also a fade) would fight
 * over it, so the first to start animating it keeps it. A later one stops its
 * own tween on it as it starts, and is done when the first is, after the
 * handback. Only the package's own reveal tweens count, so a site's tween on
 * the same element never holds anything up.
 */
export function revealCallbacks(
  el: HTMLElement,
  ctx: RevealContext,
  {
    target,
    cleanUp = cleansUp(el, ctx),
    onFinish = finish,
    onDone = () => revealed(el, { release: cleanUp }),
    hides = false,
    handsBack = true,
  }: {
    target?: HTMLElement;
    cleanUp?: boolean;
    onFinish?: (target: HTMLElement) => void;
    onDone?: (target: HTMLElement) => void;
    // The tween plays the target out rather than in (batch's onLeaveBack).
    hides?: boolean;
    // The tween animates the target's opacity and transform, so a shared
    // target can wait for it to hand them back. Not clip, which only clips.
    handsBack?: boolean;
  } = {},
): { onStart: Callback; onComplete: Callback; onInterrupt: Callback; onReverseComplete: Callback } {
  const once = !isReverse(el, ctx);
  if (once && cleanUp && handsBack && !target) registry.handsBack(el);
  const targetOf = (tween: gsap.core.Tween): HTMLElement => target ?? (tween.targets()[0] as HTMLElement);
  const stop: Callback = function () {
    registry.stopped(el, targetOf(this));
  };
  // Stopped some other way than finishing, such as a site's own
  // `gsap.killTweensOf()`: a reveal waiting on the element mustn't wait for
  // good.
  const interrupted: Callback = function () {
    const target = targetOf(this);
    registry.stopped(el, target);
    if (!registry.animating(target)) registry.settle(target);
  };
  const later = (done: HTMLElement) => () => {
    if (once) onDone(done);
  };
  // A reverse reveal is at its end once it has played in, and pending again
  // once it has played out.
  const atEnd = (done: HTMLElement, shown: boolean): void => {
    if (once) return;
    if (shown) done.removeAttribute(pendingAttribute);
    else markPending(done);
  };
  return {
    onStart() {
      const target = targetOf(this);
      if (registry.animatedByOthers(el, target)) {
        this.kill();
        registry.yieldTo(el, target, later(target));
        return;
      }
      registry.started(el, target);
    },
    onComplete() {
      const done = targetOf(this);
      registry.stopped(el, done);
      // Another reveal is still animating it, so that one hands it back.
      if (registry.animating(done)) {
        registry.yieldTo(el, done, later(done));
        return;
      }
      if (cleanUp) {
        onFinish(done);
        uncache(done);
      }
      atEnd(done, !hides);
      if (once) onDone(done);
      registry.settle(done);
    },
    onInterrupt: interrupted,
    onReverseComplete() {
      const done = targetOf(this);
      registry.stopped(el, done);
      atEnd(done, hides);
    },
  };
}
