// Makes sure an element the package has let go of can be seen. The core calls
// it for failed and skipped elements, and types call it when they don't
// animate the element's own opacity. `data-reveal-state` is already set by
// then, so `reveal.css` no longer hides the element: if it still settles at 0,
// another rule is hiding it (e.g. a site's own `[data-reveal] { opacity: 0 }`),
// so show it. Any other value is the element's own opacity and is left alone.
export function unhide(el: HTMLElement): void {
  if (restingOpacity(el) === "0") el.style.opacity = "1";
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
