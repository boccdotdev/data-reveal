import type { RevealType } from "@boccdotdev/data-reveal";

// One small drawing per type, on a 20 × 20 grid, stroked in the text colour
// with square ends and corners. A dotted part is a row of square dots: zero
// length dashes, which square caps draw as squares.

export interface IconPart {
  d: string;
  dotted?: boolean;
  /** Filled rather than stroked, for an area such as clip's masked half. */
  filled?: boolean;
}

export const icons: Record<RevealType, IconPart[]> = {
  // Dotted edges turning solid: the square fading in.
  fade: [{ d: "M4 16V4h12", dotted: true }, { d: "M16 4v12H4" }],
  // A square inside the corners of a larger one: growing to fill it.
  scale: [{ d: "M7 7h6v6H7z" }, { d: "M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" }],
  // Lines of text broken into words.
  split: [{ d: "M3 5h4M10 5h7M3 10h7M13 10h4M3 15h3M9 15h5" }],
  // Four tiles, the last still arriving.
  batch: [{ d: "M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3z" }, { d: "M12 14h5v5h-5z", dotted: true }],
  // A sharp square inside a soft, dotted edge.
  blur: [{ d: "M7 7h6v6H7z" }, { d: "M3 3h14v14H3z", dotted: true }],
  // A square, half of it masked.
  clip: [{ d: "M4 4h12v12H4z" }, { d: "M4 4h6v12H4z", filled: true }],
  // A square tipped back, as it turns into place in 3D.
  rotate: [{ d: "M6 4h8l3 12H3z" }],
  // A square with speed lines behind it.
  slide: [{ d: "M9 4h8v12H9z" }, { d: "M2 8h4M3 12h3" }],
  // Digits, as on a counter's display.
  counter: [{ d: "M5 4v12" }, { d: "M9 4h6v6H9v6h6" }],
  // Two layers, offset as they move at different speeds.
  parallax: [{ d: "M3 8h10v9H3z", dotted: true }, { d: "M7 3h10v9H7z" }],
};
