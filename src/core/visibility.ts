// Makes sure an element the package has let go of can be seen. The core calls
// it for failed and skipped elements, and types call it when they don't
// animate the element's own opacity. `data-reveal-state` is already set by
// then, so `reveal.css` no longer hides the element: if it still settles at 0,
// another rule is hiding it (e.g. a site's own `[data-reveal] { opacity: 0 }`),
// so show it. Any other value is the element's own opacity and is left alone.
export function unhide(el: HTMLElement): void {
  if (restingOpacity(el) === "0") el.style.opacity = "1";
}

// The opacity the element settles at. When `reveal.css` lets go of an element
// with `transition: opacity`, getComputedStyle reads the transition's start
// value, so take its end value instead. getAnimations() flushes pending style
// changes, so a transition the state change just started is already listed.
function restingOpacity(el: HTMLElement): string {
  const transition = el
    .getAnimations?.()
    .find((animation) => (animation as CSSTransition).transitionProperty === "opacity");
  const frames = (transition?.effect as KeyframeEffect | null | undefined)?.getKeyframes();
  const end = frames?.[frames.length - 1]?.opacity;
  return end == null ? getComputedStyle(el).opacity : String(end);
}
