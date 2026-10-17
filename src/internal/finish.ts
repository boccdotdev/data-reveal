import { gsap } from "gsap";
import { finish } from "../core/visibility.js";

/**
 * For a reveal tween's onComplete: hands `target`'s animated props back to its
 * CSS, unless another reveal is still animating it (a batch item that is also
 * a fade, say). Then that one's tween finishes last and hands them back.
 */
export function finishIfLast(tween: gsap.core.Tween, target: HTMLElement): void {
  if (gsap.getTweensOf(target, true).every((other) => other === tween)) finish(target);
}
