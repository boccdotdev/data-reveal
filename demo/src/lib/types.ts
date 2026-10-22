import type { RevealOptions, RevealType } from "@boccdotdev/data-reveal";
import type { EngineId } from "./engines";

// The controls for each animation type, as data. The panel draws them and
// the example applies them, with no code for any one type. Option names and
// built-in values come from the package's `src/types/*.ts`: a control sits at
// its `default` when the package would use that value anyway, and then the
// attribute is left out of the markup.

export type OptionKey = keyof RevealOptions;

export interface Choice {
  value: string;
  label?: string;
}

export interface Control {
  /** The option's name: the attribute is `data-reveal-<key>`. */
  key: OptionKey;
  label: string;
  kind: "segmented" | "range" | "select" | "text" | "toggle";
  /** The panel section it sits in. */
  group: "timing" | "options" | "trigger";
  /** The package's own value. "" for an option with no single built-in value. */
  default: string;
  /** Where the playground starts, if not at `default`. */
  initial?: string;
  /** For segmented controls and selects. */
  choices?: Choice[];
  /** For ranges. */
  min?: number;
  max?: number;
  step?: number;
  /** Shown after a range's value. */
  unit?: string;
  /** For text inputs. */
  placeholder?: string;
  inputMode?: "decimal";
  /** The engines that read this option. Left out, every engine does. */
  engines?: EngineId[];
}

/**
 * The element the HTML code block shows: its tag, any attributes that come
 * before `data-reveal`, and its content line by line. No `lines` makes it a
 * void element, such as an `<img>`.
 */
export interface Snippet {
  tag: string;
  attrs?: string[];
  lines?: string[];
}

export interface TypeSpec {
  id: RevealType;
  /** The page title. */
  label: string;
  /** What the type does, in one line. */
  summary: string;
  /** The type's built-in ease, or null for a type that ignores `ease`. */
  ease: string | null;
  snippet: Snippet;
  controls: Control[];
}

const duration = (value: number, max = 2): Control => ({
  key: "duration",
  label: "Duration",
  kind: "range",
  group: "timing",
  default: String(value),
  min: 0.1,
  max,
  step: 0.05,
  unit: "s",
});

const delay: Control = {
  key: "delay",
  label: "Delay",
  kind: "range",
  group: "timing",
  default: "0",
  min: 0,
  max: 1,
  step: 0.05,
  unit: "s",
};

const stagger = (value: number, max: number): Control => ({
  key: "stagger",
  label: "Stagger",
  kind: "range",
  group: "timing",
  default: String(value),
  min: 0,
  max,
  step: 0.01,
  unit: "s",
});

const distance = (label: string): Control => ({
  key: "distance",
  label,
  kind: "range",
  group: "options",
  default: "20",
  min: 0,
  max: 120,
  step: 1,
  unit: "px",
});

const direction: Control = {
  key: "direction",
  label: "Direction",
  kind: "segmented",
  group: "options",
  default: "up",
  choices: [{ value: "up" }, { value: "down" }, { value: "left" }, { value: "right" }],
};

// The built-in start is worked out per element ("top 85%", clamped near the
// end of the page), so it has no attribute value of its own.
const start: Control = {
  key: "start",
  label: "Start",
  kind: "select",
  group: "trigger",
  default: "",
  choices: [{ value: "", label: "Built-in" }, { value: "top 90%" }, { value: "top 75%" }, { value: "top center" }],
};

const reverse: Control = { key: "reverse", label: "Reverse", kind: "toggle", group: "trigger", default: "false" };
const keep: Control = { key: "keep", label: "Keep end state", kind: "toggle", group: "trigger", default: "false" };

const card = (title: string, text: string): Snippet => ({ tag: "article", lines: [`<h2>${title}</h2>`, `<p>${text}</p>`] });
const picture: Snippet = {
  tag: "img",
  attrs: ['src="picture.jpg"', 'alt="A sun over the sea"', 'width="800"', 'height="600"'],
};

export const types: TypeSpec[] = [
  {
    id: "fade",
    label: "Fade",
    summary: "Fades the element in while it moves a short way into place.",
    ease: "back.out(1.4)",
    snippet: card("Fade", "Fades in while it moves into place."),
    controls: [direction, distance("Distance"), duration(0.5), delay, start, reverse, keep],
  },
  {
    id: "scale",
    label: "Scale",
    summary: "Fades the element in while it grows from slightly smaller.",
    ease: "back.out(1.4)",
    snippet: card("Scale", "Fades in while it scales up."),
    controls: [
      { key: "from", label: "From", kind: "range", group: "options", default: "0.92", min: 0, max: 1.5, step: 0.01 },
      duration(0.5),
      delay,
      start,
      reverse,
      keep,
    ],
  },
  {
    id: "split",
    label: "Split",
    summary: "Splits text into characters, words or lines, then brings the pieces in one after another.",
    ease: "back.out(1.7)",
    snippet: { tag: "h2", lines: ["Text that arrives piece by piece as you scroll."] },
    controls: [
      {
        key: "split",
        label: "Split by",
        kind: "segmented",
        group: "options",
        default: "chars",
        choices: [{ value: "chars" }, { value: "words" }, { value: "lines" }],
      },
      {
        key: "aria",
        label: "Screen readers",
        kind: "select",
        group: "options",
        default: "",
        choices: [
          { value: "", label: "Built-in" },
          { value: "hidden", label: "hidden" },
          { value: "none", label: "none" },
          { value: "auto", label: "auto" },
        ],
      },
      stagger(0.02, 0.2),
      duration(0.5),
      delay,
      start,
      reverse,
      keep,
    ],
  },
  {
    id: "batch",
    label: "Batch",
    summary: "Brings a group of items in one after another as they scroll into view together.",
    ease: "back.out(1.4)",
    snippet: { tag: "ul", lines: ["01", "02", "03", "04", "05", "06"].map((n) => `<li data-reveal-item>${n}</li>`) },
    controls: [distance("Distance"), stagger(0.06, 0.3), duration(0.45), start, reverse, keep],
  },
  {
    id: "blur",
    label: "Blur",
    summary: "Fades the element in as it comes into focus.",
    ease: "power2.out",
    snippet: card("Blur", "Comes into focus as it fades in."),
    controls: [
      { key: "blur", label: "Blur", kind: "range", group: "options", default: "12", min: 0, max: 40, step: 1, unit: "px" },
      duration(0.6),
      delay,
      start,
      reverse,
      keep,
    ],
  },
  {
    id: "clip",
    label: "Clip",
    summary: "Wipes the element into view with a clip-path.",
    ease: "power3.out",
    snippet: picture,
    controls: [direction, duration(0.7), delay, start, reverse, keep],
  },
  {
    id: "rotate",
    label: "Rotate",
    summary: "Turns the element into place in 3D.",
    ease: "power3.out",
    snippet: card("Rotate", "Turns into place in 3D."),
    controls: [
      {
        key: "axis",
        label: "Axis",
        kind: "segmented",
        group: "options",
        default: "x",
        choices: [{ value: "x" }, { value: "y" }, { value: "z" }],
      },
      { key: "rotate", label: "Angle", kind: "range", group: "options", default: "90", min: -180, max: 180, step: 5, unit: "°" },
      duration(0.7),
      delay,
      start,
      reverse,
      keep,
    ],
  },
  {
    id: "slide",
    label: "Slide",
    summary: "Slides the element in from a full length away.",
    ease: "power3.out",
    snippet: card("Slide", "Slides in from a full length away."),
    controls: [direction, duration(0.6), delay, start, reverse, keep],
  },
  {
    id: "counter",
    label: "Counter",
    summary: "Counts up to a number when it scrolls into view.",
    ease: "power1.out",
    snippet: { tag: "p", lines: ["12480"] },
    controls: [
      { key: "to", label: "To", kind: "text", group: "options", default: "", placeholder: "12480", inputMode: "decimal" },
      { key: "from", label: "From", kind: "text", group: "options", default: "0", inputMode: "decimal" },
      {
        key: "decimals",
        label: "Decimals",
        kind: "segmented",
        group: "options",
        default: "0",
        choices: [{ value: "0" }, { value: "1" }, { value: "2" }],
      },
      {
        key: "separator",
        label: "Separator",
        kind: "segmented",
        group: "options",
        default: "",
        initial: ",",
        choices: [{ value: "", label: "none" }, { value: "," }, { value: "." }, { value: " ", label: "space" }],
      },
      { key: "prefix", label: "Prefix", kind: "text", group: "options", default: "" },
      { key: "suffix", label: "Suffix", kind: "text", group: "options", default: "" },
      duration(1.5, 4),
      start,
      reverse,
    ],
  },
  {
    id: "parallax",
    label: "Parallax",
    summary: "Moves the element at its own speed as the page scrolls, up or down.",
    ease: null,
    snippet: picture,
    controls: [
      { key: "speed", label: "Speed", kind: "range", group: "options", default: "0.3", min: 0, max: 1, step: 0.05 },
      {
        key: "start",
        label: "Start",
        kind: "select",
        group: "trigger",
        default: "top bottom",
        choices: [{ value: "top bottom" }, { value: "center bottom" }, { value: "top center" }],
      },
      {
        key: "end",
        label: "End",
        kind: "select",
        group: "trigger",
        default: "bottom top",
        choices: [{ value: "bottom top" }, { value: "center top" }, { value: "bottom center" }],
      },
    ],
  },
];

export function typeFor(id: string | null): TypeSpec {
  return types.find((type) => type.id === id) ?? types[0];
}
