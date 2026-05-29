export interface RevealContext {
  reduced: boolean;
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

export type Direction = "up" | "down" | "left" | "right";
export type Axis = "x" | "y" | "z";
export type SplitType = "chars" | "words" | "lines";
