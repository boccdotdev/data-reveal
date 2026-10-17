import type { gsap } from "gsap";
import { registry } from "../core/registry.js";
import { finish } from "../core/visibility.js";
import { uncache } from "./transform.js";

type Callback = (this: gsap.core.Tween) => void;

/**
 * Callbacks for a reveal tween, to spread into its vars (or a stagger
 * object's, for one set per item). They tell the registry while the reveal on
 * `el` is animating its target, and when the tween completes they hand the
 * target's animated props back to its CSS if `cleanUp` asks for it and no
 * other reveal is still animating it (a batch item that is also a fade). The
 * target is `target`, or else the tween's own target. Only the package's own
 * reveal tweens count, so a site's tween on the same element never holds the
 * handback up. `onFinish` replaces `finish()`, for a type with more to undo.
 */
export function revealCallbacks(
  el: Element,
  {
    target,
    cleanUp,
    onFinish = finish,
  }: { target?: HTMLElement; cleanUp: boolean; onFinish?: (target: HTMLElement) => void },
): { onStart: Callback; onComplete: Callback; onInterrupt: Callback; onReverseComplete: Callback } {
  const targetOf = (tween: gsap.core.Tween): HTMLElement => target ?? (tween.targets()[0] as HTMLElement);
  const stop: Callback = function () {
    registry.stopped(el, targetOf(this));
  };
  return {
    onStart() {
      registry.started(el, targetOf(this));
    },
    onComplete() {
      const done = targetOf(this);
      registry.stopped(el, done);
      if (cleanUp && !registry.animating(done)) {
        onFinish(done);
        uncache(done);
      }
    },
    onInterrupt: stop,
    onReverseComplete: stop,
  };
}
