import { registry } from "./registry.js";

// Makes sure an element the package has let go of can be seen. The core calls
// it for failed and skipped elements, and types call it when they don't
// animate the element's own opacity. `data-reveal-state` is already set by
// then, so `reveal.css` no longer hides the element: if it still settles at 0,
// another rule is hiding it (e.g. a site's own `[data-reveal] { opacity: 0 }`),
// so show it. Any other value is the element's own opacity and is left alone.
// So is an element a reveal has hidden as its starting state (a split that
// is also a batch item, skipped by an instance without split): that reveal
// shows it.
export function unhide(el: HTMLElement): void {
  if (registry.hiddenByReveal(el)) return;
  if (restingOpacity(el) === "0") el.style.opacity = "1";
}

/**
 * The opacity a reveal should end at: the element's own, or 1 if it would
 * otherwise settle at 0 (a site's own pre-hide). Read it before hiding the
 * element, so a finished reveal can hand opacity back to the element's CSS
 * without a jump.
 *
 * Another reveal on the element (a batch item that is also a fade) may have
 * hidden it already, so then it's read as its snapshot recorded it, and the
 * current state is put back afterwards. `reveal.css` may also still be
 * hiding it, as a reveal element its own type hasn't reached yet, so that is
 * lifted while reading.
 */
export function shownOpacity(el: HTMLElement): number {
  const { shared } = registry.styledBefore(el);
  const style = el.getAttribute("style");
  if (shared) registry.restoreAnimated(el);
  const waiting = el.matches("[data-reveal]:not([data-reveal-state])");
  if (waiting) el.setAttribute("data-reveal-state", "ready");
  const opacity = parseFloat(restingOpacity(el) ?? "");
  if (waiting) el.removeAttribute("data-reveal-state");
  if (shared) {
    if (style === null) el.removeAttribute("style");
    else el.setAttribute("style", style);
  }
  return opacity > 0 ? opacity : 1;
}

/**
 * Called when a play-once reveal finishes on `target`. Hands the props it
 * animated back to the element's own CSS, so nothing is left inline: no
 * transform to trap `position: fixed` children, no clip-path to cut off
 * overflow, no opacity to beat a hover class. Then makes sure a site's own
 * pre-hide can't hide it again.
 */
export function finish(target: HTMLElement): void {
  registry.restoreAnimated(target);
  unhide(target);
}

// The opacity the element settles at, or null while an animation of the
// site's own (a CSS `animation`, say) is driving it: that animation decides
// where the element ends up, so it's left alone. getAnimations() flushes
// pending style changes, so an animation or transition the state change just
// started is already listed.
function restingOpacity(el: HTMLElement): string | null {
  let end: unknown;
  for (const animation of el.getAnimations?.() ?? []) {
    const frames = (animation.effect as KeyframeEffect | null)?.getKeyframes() ?? [];
    if (!frames.some((frame) => frame.opacity != null)) continue;
    // A transition on opacity, e.g. when `reveal.css` lets go of an element
    // with `transition: opacity`, reads as its start value, so take its end.
    if ((animation as CSSTransition).transitionProperty !== "opacity") return null;
    end = frames[frames.length - 1].opacity;
  }
  return end == null ? getComputedStyle(el).opacity : String(end);
}
