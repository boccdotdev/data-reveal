export type Direction = "up" | "down" | "left" | "right";
export type Axis = "x" | "y" | "z";
export type SplitType = "chars" | "words" | "lines";

/**
 * Every option a reveal reads, named after its attribute without the
 * `data-reveal-` prefix (`data-reveal-duration` is `duration`). Each type
 * reads the ones that apply to it. An attribute on the element always wins
 * over these.
 */
export interface RevealOptions {
  /** Seconds. */
  duration?: number;
  /** Seconds. */
  delay?: number;
  /**
   * ScrollTrigger `start`, used exactly as given. The built-in one is clamped
   * to the bottom of the page for content that can't scroll as far as it.
   */
  start?: string;
  /** ScrollTrigger `end` (`parallax`). */
  end?: string;
  /** GSAP ease. `parallax` is scrubbed and ignores it. */
  ease?: string;
  /** px (`fade`, `batch`). */
  distance?: number;
  /** Seconds between pieces (`split`, `batch`). */
  stagger?: number;
  /** `fade`, `clip`, `slide`. */
  direction?: Direction;
  /** Starting scale for `scale`, starting number for `counter`. Set it in `typeDefaults`. */
  from?: number;
  /** Target number (`counter`). */
  to?: number;
  /** Starting blur in px (`blur`). */
  blur?: number;
  /** `rotate`. */
  axis?: Axis;
  /** Degrees (`rotate`). */
  rotate?: number;
  /** `split`. */
  split?: SplitType;
  /** Higher moves more (`parallax`). */
  speed?: number;
  /** Decimal places (`counter`). */
  decimals?: number;
  /** Thousands separator (`counter`). */
  separator?: string;
  /** `counter`. */
  prefix?: string;
  /** `counter`. */
  suffix?: string;
  /** Play out again when scrolling back up past `start`. `parallax` always does. */
  reverse?: boolean;
}

/** Options per type, applied over `defaults`. */
export type RevealTypeDefaults = Partial<Record<RevealType, RevealOptions>>;

/** The options both `createReveal()` entries accept on top of their own. */
export interface RevealDefaults {
  /**
   * Options for every type, except where an option means something else to
   * a type: `parallax` ignores `start` and `end` here, `counter` ignores
   * `duration`, and `split` ignores `stagger`. Set those in `typeDefaults`.
   */
  defaults?: RevealOptions;
  /** Options per type, over `defaults`. Type-specific options like `from` belong here. */
  typeDefaults?: RevealTypeDefaults;
}

export interface RevealContext {
  reduced: boolean;
  /**
   * `defaults` with this type's `typeDefaults` applied over them. The core
   * always passes it; an element's own attributes still win over it.
   */
  defaults?: RevealOptions;
}

export type RevealInit = (el: HTMLElement, ctx: RevealContext) => void;

/**
 * A type paired with its init, for explicit registration via the loaders-free
 * `@boccdotdev/data-reveal/manual` entry. Each `src/types/X.ts` exports one as
 * a named const (e.g. `fade`), so consumers register only the types they use.
 */
export interface RevealRegistration {
  type: RevealType;
  init: RevealInit;
}

export type RevealType =
  | "fade"
  | "scale"
  | "split"
  | "batch"
  | "blur"
  | "clip"
  | "rotate"
  | "slide"
  | "counter"
  | "parallax";
