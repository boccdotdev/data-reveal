import type { ScrollTrigger } from "gsap/ScrollTrigger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultStart } from "../../src/internal/trigger";
import type { RevealContext, RevealInit } from "../../src/internal/types";
import { init as batch } from "../../src/types/batch";
import { init as blur } from "../../src/types/blur";
import { init as clip } from "../../src/types/clip";
import { init as counter } from "../../src/types/counter";
import { init as fade } from "../../src/types/fade";
import { init as parallax } from "../../src/types/parallax";
import { init as rotate } from "../../src/types/rotate";
import { init as scale } from "../../src/types/scale";
import { init as slide } from "../../src/types/slide";
import { init as split } from "../../src/types/split";
import { html } from "./helpers";

type Vars = Record<string, unknown> & { scrollTrigger?: { start?: unknown } };

// GSAP stand-ins that record the tweens and triggers each type asks for.
const recorded = vi.hoisted(() => ({
  to: [] as Array<Record<string, unknown>>,
  fromTo: [] as Array<Record<string, unknown>>,
  batch: [] as Array<Record<string, unknown>>,
}));
vi.mock("gsap", () => ({
  gsap: {
    registerPlugin: () => {},
    set: () => {},
    to: (_target: unknown, vars: Record<string, unknown>) => {
      recorded.to.push(vars);
      return { kill: () => {} };
    },
    fromTo: (_target: unknown, _from: unknown, vars: Record<string, unknown>) => {
      recorded.fromTo.push(vars);
      return { kill: () => {} };
    },
  },
}));
vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: {
    batch: (_targets: unknown, vars: Record<string, unknown>) => {
      recorded.batch.push(vars);
      return [];
    },
  },
}));
vi.mock("gsap/SplitText", () => ({
  SplitText: { create: () => ({ chars: [], words: [], lines: [], revert: () => {} }) },
}));

beforeEach(() => {
  recorded.to.length = 0;
  recorded.fromTo.length = 0;
  recorded.batch.length = 0;
  document.body.innerHTML = "";
});

function element(attributes = ""): HTMLElement {
  html(`<div id="target" ${attributes}>12</div>`);
  return document.getElementById("target") as HTMLElement;
}

function run(init: RevealInit, attributes = "", defaults: RevealContext["defaults"] = {}): Vars {
  init(element(attributes), { reduced: false, defaults });
  return recorded.to[recorded.to.length - 1] as Vars;
}

// The eases each type used before ease became an option, which stay its built-in ones.
const builtInEases: Array<[string, RevealInit, string]> = [
  ["fade", fade, "back.out(1.4)"],
  ["scale", scale, "back.out(1.4)"],
  ["blur", blur, "power2.out"],
  ["clip", clip, "power3.out"],
  ["rotate", rotate, "power3.out"],
  ["slide", slide, "power3.out"],
  ["split", split, "back.out(1.7)"],
  ["counter", counter, "power1.out"],
];

describe.each(builtInEases)("%s", (_name, init, builtInEase) => {
  it("keeps its built-in ease when none is set", () => {
    expect(run(init).ease).toBe(builtInEase);
  });

  it("takes ease from the defaults, and from data-reveal-ease over them", () => {
    expect(run(init, "", { ease: "power4.in" }).ease).toBe("power4.in");
    expect(run(init, 'data-reveal-ease="steps(4)"', { ease: "power4.in" }).ease).toBe("steps(4)");
  });

  it("takes duration from the defaults, and from the attribute over them", () => {
    expect(run(init, "", { duration: 3 }).duration).toBe(3);
    expect(run(init, 'data-reveal-duration="0.25"', { duration: 3 }).duration).toBe(0.25);
  });

  it("uses the built-in start unless one is set, and a set one exactly as given", () => {
    expect(run(init).scrollTrigger?.start).toBe(defaultStart);
    expect(run(init, "", { start: "top 75%" }).scrollTrigger?.start).toBe("top 75%");
    expect(run(init, 'data-reveal-start="top 85%"').scrollTrigger?.start).toBe("top 85%");
  });
});

describe("batch", () => {
  function batchVars(attributes = "", defaults: RevealContext["defaults"] = {}): Vars {
    html(`<ul id="list" ${attributes}><li>one</li></ul>`);
    batch(document.getElementById("list") as HTMLElement, { reduced: false, defaults });
    return recorded.batch[recorded.batch.length - 1] as Vars;
  }

  function easeOf(callback: unknown): unknown {
    (callback as (group: Element[]) => void)([]);
    return recorded.to[recorded.to.length - 1].ease;
  }

  it("eases in and out with its built-in eases when none is set", () => {
    const vars = batchVars("data-reveal-reverse");
    expect(easeOf(vars.onEnter)).toBe("back.out(1.4)");
    expect(easeOf(vars.onLeaveBack)).toBe("power2.in");
  });

  it("uses a set ease both ways", () => {
    const vars = batchVars('data-reveal-reverse data-reveal-ease="none"', { ease: "power4.in" });
    expect(easeOf(vars.onEnter)).toBe("none");
    expect(easeOf(vars.onLeaveBack)).toBe("none");
  });

  it("uses the built-in start unless one is set", () => {
    expect(batchVars().start).toBe(defaultStart);
    expect(batchVars("", { start: "top 75%" }).start).toBe("top 75%");
  });
});

describe("parallax", () => {
  function parallaxVars(attributes = "", defaults: RevealContext["defaults"] = {}): Vars {
    parallax(element(attributes), { reduced: false, defaults });
    return recorded.fromTo[recorded.fromTo.length - 1] as Vars;
  }

  it("ignores ease, since it's scrubbed", () => {
    expect(parallaxVars('data-reveal-ease="power4.in"', { ease: "back.out(2)" }).ease).toBe("none");
  });

  it("starts as the element enters the viewport, unclamped, unless a start is set", () => {
    expect(parallaxVars().scrollTrigger?.start).toBe("top bottom");
    expect(parallaxVars("", { start: "top 75%" }).scrollTrigger?.start).toBe("top 75%");
  });
});

describe("the built-in start", () => {
  function stub(target: object, values: Record<string, number>): void {
    for (const [name, value] of Object.entries(values)) {
      Object.defineProperty(target, name, { configurable: true, value });
    }
  }

  // A 720px window: its 85% line is at 612px.
  const realInnerHeight = window.innerHeight;
  beforeEach(() => stub(window, { innerHeight: 720 }));
  afterEach(() => stub(window, { innerHeight: realInnerHeight }));

  function startFor(top: number, scroller: Element | Window = window): string {
    const target = element();
    target.getBoundingClientRect = () => ({ top }) as DOMRect;
    return defaultStart({ trigger: target, scroller } as unknown as ScrollTrigger);
  }

  function pageHeight(height: number): void {
    stub(document.documentElement, { scrollHeight: height });
    stub(document.body, { scrollHeight: height });
  }

  function innerScroller(scrollHeight: number): HTMLElement {
    const scroller = document.createElement("div");
    // 300px down the window, 420px tall: its 85% line is 357px in, or 657px in the window.
    scroller.getBoundingClientRect = () => ({ top: 300 }) as DOMRect;
    stub(scroller, { clientTop: 0, clientHeight: 420, scrollTop: 0, scrollHeight });
    return scroller;
  }

  it("doesn't clamp an element above the 85% line, so content in view at load plays straight away", () => {
    pageHeight(window.innerHeight * 3);
    expect(startFor(window.innerHeight * 0.5)).toBe("top 85%");
  });

  it("clamps an element below the line, so the end of the page can still reach it", () => {
    pageHeight(window.innerHeight * 3);
    expect(startFor(window.innerHeight)).toBe("clamp(top 85%)");
  });

  it("starts an element below the line when it enters the viewport if the page can't scroll", () => {
    pageHeight(window.innerHeight);
    expect(startFor(window.innerHeight * 0.9)).toBe("top bottom");
  });

  it("measures against an element scroller, not the window", () => {
    // 335px into the scroller: above its line, though below the window's.
    expect(startFor(635, innerScroller(2000))).toBe("top 85%");
    expect(startFor(700, innerScroller(2000))).toBe("clamp(top 85%)");
    expect(startFor(700, innerScroller(420))).toBe("top bottom");
  });
});
