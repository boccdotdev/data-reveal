import { beforeEach, describe, expect, it } from "vitest";
import { option, options, parseOption, parseOptions } from "../../src/internal/options";
import type { RevealContext } from "../../src/internal/types";
import { el, html } from "./helpers";

beforeEach(() => {
  document.body.innerHTML = "";
});

const builtIn = { duration: 0.5, distance: 20, ease: "back.out(1.4)" };

describe("options()", () => {
  it("takes the attribute, then the defaults, then the built-in value", () => {
    html(`<div id="a" data-reveal-duration="0.9"></div>`);
    const ctx: RevealContext = { reduced: false, defaults: { duration: 2, distance: 40 } };

    expect(options(el("a"), ctx, builtIn)).toEqual({ duration: 0.9, distance: 40, ease: "back.out(1.4)" });
  });

  it("falls back to the built-in values without defaults", () => {
    html(`<div id="a"></div>`);
    expect(options(el("a"), { reduced: false }, builtIn)).toEqual(builtIn);
  });

  it("only returns the options asked for", () => {
    html(`<div id="a" data-reveal-stagger="0.1"></div>`);
    expect(options(el("a"), { reduced: false, defaults: { speed: 2 } }, builtIn)).toEqual(builtIn);
  });

  it("treats an empty or unparsable number as unset", () => {
    html(`<div id="empty" data-reveal-duration=""></div><div id="junk" data-reveal-duration="slow"></div>`);
    const ctx: RevealContext = { reduced: false, defaults: { duration: 2 } };

    expect(options(el("empty"), ctx, builtIn).duration).toBe(2);
    expect(options(el("junk"), ctx, builtIn).duration).toBe(2);
  });

  it("treats an empty string option as unset", () => {
    html(`<div id="a" data-reveal-ease=""></div>`);
    expect(options(el("a"), { reduced: false, defaults: { ease: "none" } }, builtIn).ease).toBe("none");
  });
});

describe("option()", () => {
  it("is undefined when neither the attribute nor the defaults set it", () => {
    html(`<div id="a"></div>`);
    expect(option(el("a"), { reduced: false, defaults: {} }, "ease")).toBeUndefined();
  });

  it("reads a formatted `to` as a number", () => {
    html(`<div id="a" data-reveal-to="1,200"></div>`);
    expect(option(el("a"), { reduced: false }, "to")).toBe(1200);
  });

  it("keeps an empty separator, prefix or suffix", () => {
    html(`<div id="a" data-reveal-separator=""></div>`);
    expect(option(el("a"), { reduced: false, defaults: { separator: "," } }, "separator")).toBe("");
  });

  it('reads reverse as on when present, unless it\'s "false"', () => {
    html(`
      <div id="bare" data-reveal-reverse></div>
      <div id="off" data-reveal-reverse="false"></div>
      <div id="unset"></div>
    `);
    const ctx: RevealContext = { reduced: false, defaults: { reverse: true } };

    expect(option(el("bare"), { reduced: false }, "reverse")).toBe(true);
    expect(option(el("off"), ctx, "reverse")).toBe(false);
    expect(option(el("unset"), ctx, "reverse")).toBe(true);
  });
});

describe("parseOption()", () => {
  it("reads numbers from numbers or strings, and drops the rest", () => {
    expect(parseOption("duration", 0.5)).toBe(0.5);
    expect(parseOption("duration", "0.5")).toBe(0.5);
    expect(parseOption("duration", "soon")).toBeUndefined();
    expect(parseOption("duration", true)).toBeUndefined();
  });

  it("treats an empty string option as unset, but keeps an empty text one", () => {
    expect(parseOption("start", "")).toBeUndefined();
    expect(parseOption("start", 200)).toBeUndefined();
    expect(parseOption("prefix", "")).toBe("");
  });

  it('reads reverse from a boolean, or from a string where only "false" is off', () => {
    expect(parseOption("reverse", false)).toBe(false);
    expect(parseOption("reverse", "false")).toBe(false);
    expect(parseOption("reverse", "")).toBe(true);
    expect(parseOption("reverse", 0)).toBeUndefined();
  });
});

describe("parseOptions()", () => {
  it("keeps only the options that are set and readable", () => {
    expect(parseOptions({ duration: 1, ease: "", speed: Number.NaN, reverse: undefined })).toEqual({ duration: 1 });
    expect(parseOptions(undefined)).toEqual({});
  });
});
