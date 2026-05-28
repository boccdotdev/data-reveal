export interface RevealContext {
  reduced: boolean;
}

export type RevealInit = (el: HTMLElement, ctx: RevealContext) => void;

export interface RevealTypeModule {
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
