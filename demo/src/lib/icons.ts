import type { RevealType } from "@boccdotdev/data-reveal";

// One small drawing per type, on a 20 × 20 grid, stroked in the text colour
// with square ends and corners. A dotted part is a row of square dots: zero
// length dashes, which square caps draw as squares. `alternate` is a second
// drawing for the owner to choose between on /icons/.

export interface IconPart {
  d: string;
  dotted?: boolean;
  /** Filled rather than stroked, for an area such as clip's masked half. */
  filled?: boolean;
}

export interface IconSet {
  main: IconPart[];
  alternate?: IconPart[];
}

export const icons: Record<RevealType, IconSet> = {
  // Dotted edges turning solid: the square fading in.
  fade: {
    main: [{ d: "M4 16V4h12", dotted: true }, { d: "M16 4v12H4" }],
    alternate: [{ d: "M3 9h9v8H3z", dotted: true }, { d: "M8 3h9v8H8z" }],
  },
  // A square inside the corners of a larger one: growing to fill it.
  scale: {
    main: [{ d: "M7 7h6v6H7z" }, { d: "M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" }],
    alternate: [{ d: "M8 8h4v4H8z" }, { d: "M3 3h14v14H3z", dotted: true }],
  },
  // Lines of text broken into words.
  split: {
    main: [{ d: "M3 5h4M10 5h7M3 10h7M13 10h4M3 15h3M9 15h5" }],
    alternate: [{ d: "M3 15l3-10 3 10M4 11h4" }, { d: "M12 5v10M12 5h3v5h-3M12 10h4v5h-4" }],
  },
  // Four tiles, the last still arriving.
  batch: {
    main: [{ d: "M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3z" }, { d: "M12 14h5v5h-5z", dotted: true }],
    alternate: [{ d: "M3 3h5v5H3zM12 5h5v5h-5z" }, { d: "M3 13h5v5H3zM12 15h5v3", dotted: true }],
  },
  // A sharp square inside a soft, dotted edge.
  blur: {
    main: [{ d: "M7 7h6v6H7z" }, { d: "M3 3h14v14H3z", dotted: true }],
  },
  // A square, half of it masked.
  clip: {
    main: [{ d: "M4 4h12v12H4z" }, { d: "M4 4h6v12H4z", filled: true }],
    alternate: [{ d: "M4 4h12v12H4z" }, { d: "M4 10h12" }, { d: "M4 4h12v6H4z", filled: true }],
  },
  // A square tipped back, as it turns into place in 3D.
  rotate: {
    main: [{ d: "M6 4h8l3 12H3z" }],
    alternate: [{ d: "M10 2l8 8-8 8-8-8z" }],
  },
  // A square with speed lines behind it.
  slide: {
    main: [{ d: "M9 4h8v12H9z" }, { d: "M2 8h4M3 12h3" }],
  },
  // Digits, as on a counter's display.
  counter: {
    main: [{ d: "M5 4v12" }, { d: "M9 4h6v6H9v6h6" }],
    alternate: [{ d: "M3 4h5v12H3zM11 4h6v6h-6v6h6" }],
  },
  // Two layers, offset as they move at different speeds.
  parallax: {
    main: [{ d: "M3 8h10v9H3z", dotted: true }, { d: "M7 3h10v9H7z" }],
    alternate: [{ d: "M3 5h14M5 10h12M2 15h11" }],
  },
};
