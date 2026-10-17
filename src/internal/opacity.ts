/**
 * Tween `modifiers` that keep opacity at or below the element's own, `end`.
 * An overshooting ease (the built-in `back.out`) would otherwise take an
 * element with `opacity: 0.6` of its own up to 0.64 before it settles.
 */
export function capOpacity(end: number | ((target: Element) => number)): {
  opacity: (value: string | number, target: Element) => number;
} {
  return {
    opacity: (value, target) => Math.min(parseFloat(String(value)), typeof end === "number" ? end : end(target)),
  };
}
