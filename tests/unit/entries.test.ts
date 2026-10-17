import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReveal } from "../../src/core/createReveal";
import { options } from "../../src/internal/options";
import type { RevealInit, RevealRegistration } from "../../src/internal/types";
import { createReveal as createManualReveal } from "../../src/manual";
import { el, html, state } from "./helpers";

// Arming an element schedules a ScrollTrigger refresh.
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: { refresh: vi.fn(), getAll: () => [] } }));

// Stand-ins for the fade and scale modules that record the options they
// resolve, as the real types do.
const resolved = vi.hoisted(() => new Map<string, unknown>());
const recordOptions: RevealInit = (target, ctx) => {
  resolved.set(target.id, options(target, ctx, { duration: 0.5, distance: 20, ease: "built-in" }));
};
vi.mock("../../src/types/fade", () => ({ init: recordOptions }));
vi.mock("../../src/types/scale", () => ({ init: recordOptions }));

const defaultsMarkup = `
  <div id="plain" data-reveal="fade"></div>
  <div id="attribute" data-reveal="fade" data-reveal-duration="0.9"></div>
  <div id="other" data-reveal="scale"></div>
`;
const createOptions = {
  defaults: { duration: 1, distance: 40 },
  typeDefaults: { fade: { duration: 0.2 } },
};
// Attribute, then the type's own default, then the global one, then built-in.
const expected = {
  plain: { duration: 0.2, distance: 40, ease: "built-in" },
  attribute: { duration: 0.9, distance: 40, ease: "built-in" },
  other: { duration: 1, distance: 40, ease: "built-in" },
};

beforeEach(() => {
  document.body.innerHTML = "";
  resolved.clear();
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

describe("auto entry options", () => {
  it("resolves each option from the attribute, typeDefaults, defaults, then the built-in", async () => {
    html(defaultsMarkup);
    await createReveal(createOptions).init();
    expect(Object.fromEntries(resolved)).toEqual(expected);
  });

  it("works without options", async () => {
    html(`<div id="plain" data-reveal="fade"></div>`);
    await createReveal().init();
    expect(resolved.get("plain")).toEqual({ duration: 0.5, distance: 20, ease: "built-in" });
  });
});

describe("manual entry options", () => {
  it("resolves each option from the attribute, typeDefaults, defaults, then the built-in", async () => {
    html(defaultsMarkup);
    const types: RevealRegistration[] = [
      { type: "fade", init: recordOptions },
      { type: "scale", init: recordOptions },
    ];
    await createManualReveal({ types, ...createOptions }).init();
    expect(Object.fromEntries(resolved)).toEqual(expected);
  });
});

describe("manual entry", () => {
  it("runs registered types and skips the rest", async () => {
    const init = vi.fn();
    const fade: RevealRegistration = { type: "fade", init };
    html(`<div id="a" data-reveal="fade"></div><div id="b" data-reveal="scale"></div>`);

    await createManualReveal({ types: [fade] }).init();
    expect(init).toHaveBeenCalledWith(el("a"), { reduced: false, defaults: {} });
    expect(state("a")).toBe("ready");
    expect(state("b")).toBe("skipped");
  });
});
