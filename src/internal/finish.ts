import type { gsap } from "gsap";
import { registry } from "../core/registry.js";
import { setState } from "../core/state.js";
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
  if (release) registry.release(el);
  else registry.finished(el);
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
  }: {
    target?: HTMLElement;
    cleanUp?: boolean;
    onFinish?: (target: HTMLElement) => void;
    onDone?: (target: HTMLElement) => void;
  } = {},
): { onStart: Callback; onComplete: Callback; onInterrupt: Callback; onReverseComplete: Callback } {
  const once = !isReverse(el, ctx);
  const targetOf = (tween: gsap.core.Tween): HTMLElement => target ?? (tween.targets()[0] as HTMLElement);
  const stop: Callback = function () {
    registry.stopped(el, targetOf(this));
  };
  const later = (done: HTMLElement) => () => {
    if (once) onDone(done);
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
      if (once) onDone(done);
      registry.settle(done);
    },
    onInterrupt: stop,
    onReverseComplete: stop,
  };
}
