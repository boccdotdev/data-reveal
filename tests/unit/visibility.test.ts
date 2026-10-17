import { beforeEach, describe, expect, it } from "vitest";
import { unhide } from "../../src/core/visibility";
import { el, html } from "./helpers";

beforeEach(() => {
  document.head.innerHTML = `<style>.hidden { opacity: 0; } .muted { opacity: 0.6; }</style>`;
  document.body.innerHTML = "";
});

// Stands in for the CSSTransition a browser starts when `reveal.css` lets go
// of an element with `transition: opacity`.
function transitioning(target: HTMLElement, from: string, to: string): void {
  const transition = {
    transitionProperty: "opacity",
    effect: { getKeyframes: () => [{ opacity: from }, { opacity: to }] },
  };
  target.getAnimations = () => [transition as unknown as Animation];
}

describe("unhide()", () => {
  it("shows an element that computes to opacity 0", () => {
    html(`<div id="a" class="hidden"></div>`);
    unhide(el("a"));
    expect(el("a").style.opacity).toBe("1");
  });

  it("leaves any other opacity alone", () => {
    html(`<div id="a" class="muted"></div><div id="b"></div>`);
    unhide(el("a"));
    unhide(el("b"));
    expect(el("a").style.opacity).toBe("");
    expect(el("b").style.opacity).toBe("");
  });

  it("goes by where a running opacity transition ends, not where it starts", () => {
    html(`<div id="muted" class="hidden"></div><div id="hidden" class="hidden"></div>`);
    // Both compute to 0 right now, at the start of their transitions.
    transitioning(el("muted"), "0", "0.6");
    transitioning(el("hidden"), "0.6", "0");

    unhide(el("muted"));
    unhide(el("hidden"));
    expect(el("muted").style.opacity).toBe("");
    expect(el("hidden").style.opacity).toBe("1");
  });
});
