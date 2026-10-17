import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReveal } from "../../src/core/createReveal";
import { createReveal as createManualReveal } from "../../src/manual";
import type { RevealRegistration } from "../../src/internal/types";
import { el, html, state } from "./helpers";

// The manual test arms an element, which schedules a ScrollTrigger refresh.
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: { refresh: vi.fn() } }));

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("auto entry", () => {
  it("skips type names that only exist on Object.prototype", async () => {
    html(`
      <div id="valueOf" data-reveal="valueOf"></div>
      <div id="constructor" data-reveal="constructor"></div>
      <div id="hasOwnProperty" data-reveal="hasOwnProperty"></div>
    `);

    await expect(createReveal().init()).resolves.toBeUndefined();
    expect(state("valueOf")).toBe("skipped");
    expect(state("constructor")).toBe("skipped");
    expect(state("hasOwnProperty")).toBe("skipped");
  });
});

describe("manual entry", () => {
  it("runs registered types and skips the rest", async () => {
    const init = vi.fn();
    const fade: RevealRegistration = { type: "fade", init };
    html(`<div id="a" data-reveal="fade"></div><div id="b" data-reveal="scale"></div>`);

    await createManualReveal({ types: [fade] }).init();
    expect(init).toHaveBeenCalledWith(el("a"), { reduced: false });
    expect(state("a")).toBe("ready");
    expect(state("b")).toBe("skipped");
  });
});
