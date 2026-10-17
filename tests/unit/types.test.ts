import type { ScrollTrigger } from "gsap/ScrollTrigger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registry } from "../../src/core/registry";
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
// `own` is the transform getProperty() reports, as if from the element's CSS.
const recorded = vi.hoisted(() => ({
  to: [] as Array<Record<string, unknown>>,
  fromTo: [] as Array<Record<string, unknown>>,
  batch: [] as Array<Record<string, unknown>>,
  set: [] as Array<Record<string, unknown>>,
  own: {} as Record<string, number>,
  // The tweens getTweensOf() reports as running on a target.
  active: [] as unknown[],
}));
vi.mock("gsap", () => ({
  gsap: {
    registerPlugin: () => {},
    set: (_target: unknown, vars: Record<string, unknown>) => {
      recorded.set.push(vars);
    },
    getTweensOf: () => recorded.active,
    getProperty: (_target: unknown, property: string) =>
      recorded.own[property] ?? (property.startsWith("scale") ? 1 : 0),
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
  recorded.set.length = 0;
  recorded.own = {};
  recorded.active = [];
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

// Play-once types, which hand the props they animated back when they finish.
const oneShot = builtInEases.filter(([name]) => name !== "split" && name !== "counter");

describe.each(oneShot)("%s when it finishes", (_name, init) => {
  it("hands the animated props back to the element's own CSS", () => {
    const target = element('style="color: red;"');
    // As the core does before a type's init.
    registry.snapshot(target, target);
    init(target, { reduced: false, defaults: {} });
    const vars = recorded.to[recorded.to.length - 1];
    // Stand in for the end state GSAP leaves inline.
    Object.assign(target.style, {
      opacity: "1",
      transform: "translate(0px, 0px)",
      clipPath: "inset(0px)",
      filter: "blur(0px)",
    });

    const tween = {};
    recorded.active = [tween];
    (vars.onComplete as (this: unknown) => void).call(tween);
    expect(target.style.cssText).toBe("color: red;");
  });

  it("leaves them while another reveal is still animating the element", () => {
    const target = element('style="color: red;"');
    registry.snapshot(target, target);
    init(target, { reduced: false, defaults: {} });
    const vars = recorded.to[recorded.to.length - 1];
    target.style.transform = "translate(0px, 20px)";

    const tween = {};
    recorded.active = [tween, { another: "tween" }];
    (vars.onComplete as (this: unknown) => void).call(tween);
    expect(target.style.transform).toBe("translate(0px, 20px)");
  });

  it("animates to the element's own opacity, so handing it back doesn't jump", () => {
    document.head.innerHTML = `<style>.muted { opacity: 0.6; }</style>`;
    const vars = run(init, 'class="muted"');
    document.head.innerHTML = "";
    // clip doesn't animate opacity at all.
    if ("opacity" in vars) expect(vars.opacity).toBe(0.6);
  });

  it("keeps its end state with reverse or keep", () => {
    expect(run(init, "data-reveal-reverse").onComplete).toBeUndefined();
    expect(run(init, "data-reveal-keep").onComplete).toBeUndefined();
    expect(run(init, "", { keep: true }).onComplete).toBeUndefined();
  });
});

describe("counter", () => {
  it("leaves its own text on destroy() when that already shows the target", () => {
    const target = element();
    registry.snapshot(target, target);
    counter(target, { reduced: false, defaults: {} });
    expect(target.textContent).toBe("0");

    registry.killElement(target, { restore: "animated" });
    expect(target.textContent).toBe("12");
  });

  it("leaves the formatted target on destroy() in place of a placeholder", () => {
    html(`<div id="target" data-reveal-to="1200" data-reveal-separator=",">0</div>`);
    const target = document.getElementById("target") as HTMLElement;
    registry.snapshot(target, target);
    counter(target, { reduced: false, defaults: {} });

    registry.killElement(target, { restore: "animated" });
    expect(target.textContent).toBe("1,200");
  });
});

describe("a transform of the element's own", () => {
  const lastSet = () => recorded.set[recorded.set.length - 1];
  const lastTo = () => recorded.to[recorded.to.length - 1];

  it("fade starts at its own position plus the offset and ends on it", () => {
    recorded.own = { x: 10, y: -30 };
    run(fade);
    expect(lastSet()).toMatchObject({ x: 10, y: -10 });
    expect(lastTo()).toMatchObject({ x: 10, y: -30 });
  });

  it("slide starts its own percentage plus a box away and ends on it", () => {
    recorded.own = { xPercent: -50 };
    run(slide, 'data-reveal-direction="left"');
    expect(lastSet()).toMatchObject({ xPercent: 50, yPercent: 0 });
    expect(lastTo()).toMatchObject({ xPercent: -50, yPercent: 0 });
  });

  it("scale starts at `from` times its own scale and ends on it", () => {
    recorded.own = { scaleX: 1.2, scaleY: 1.2 };
    run(scale, 'data-reveal-from="0.5"');
    expect(lastSet()).toMatchObject({ scaleX: 0.6, scaleY: 0.6 });
    expect(lastTo()).toMatchObject({ scaleX: 1.2, scaleY: 1.2 });
  });

  it("rotate turns from its own angle plus `rotate` back to its own", () => {
    recorded.own = { rotation: 8 };
    run(rotate, 'data-reveal-axis="z"');
    expect(lastSet()).toMatchObject({ rotation: 98 });
    expect(lastTo()).toMatchObject({ rotation: 8 });
  });

  it("batch moves each item from its own y plus the distance to its own y", () => {
    recorded.own = { y: -30 };
    html(`<ul id="list"><li id="item">one</li></ul>`);
    const item = document.getElementById("item") as HTMLElement;
    batch(document.getElementById("list") as HTMLElement, { reduced: false, defaults: {} });
    const hidden = lastSet() as { y: (index: number, target: Element) => number };
    expect(hidden.y(0, item)).toBe(-10);

    const vars = recorded.batch[recorded.batch.length - 1] as Vars;
    (vars.onEnter as (group: Element[]) => void)([item]);
    expect((lastTo() as { y: (index: number, target: Element) => number }).y(0, item)).toBe(-30);
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

  it("hands each item's animated props back when that item finishes", () => {
    const vars = batchVars();
    const item = document.querySelector("li") as HTMLElement;
    (vars.onEnter as (group: Element[]) => void)([item]);
    const tween = recorded.to[recorded.to.length - 1] as { stagger: { onComplete: (this: unknown) => void } };
    Object.assign(item.style, { opacity: "1", transform: "translate(0px, 0px)" });

    const itemTween = { targets: () => [item] };
    recorded.active = [itemTween];
    tween.stagger.onComplete.call(itemTween);
    expect(item.hasAttribute("style")).toBe(false);
  });

  it("animates each item to its own opacity", () => {
    document.head.innerHTML = `<style>.muted { opacity: 0.6; }</style>`;
    html(`<ul id="list"><li id="plain">one</li><li id="muted" class="muted">two</li></ul>`);
    batch(document.getElementById("list") as HTMLElement, { reduced: false, defaults: {} });
    document.head.innerHTML = "";
    const vars = recorded.batch[recorded.batch.length - 1] as Vars;
    (vars.onEnter as (group: Element[]) => void)([]);
    const opacity = recorded.to[recorded.to.length - 1].opacity as (index: number, item: Element) => number;

    expect(opacity(0, document.getElementById("plain") as Element)).toBe(1);
    expect(opacity(1, document.getElementById("muted") as Element)).toBe(0.6);
  });

  it("keeps the items' end state with reverse or keep", () => {
    const staggerOf = (vars: Vars) => {
      (vars.onEnter as (group: Element[]) => void)([]);
      return recorded.to[recorded.to.length - 1].stagger;
    };
    expect(staggerOf(batchVars("data-reveal-reverse"))).toBe(0.06);
    expect(staggerOf(batchVars("data-reveal-keep"))).toBe(0.06);
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
    // 300px down the window with a 40px top border, then 380px to scroll in:
    // its 85% line is 323px in, or 663px in the window.
    scroller.getBoundingClientRect = () => ({ top: 300 }) as DOMRect;
    stub(scroller, { clientTop: 40, clientHeight: 380, scrollTop: 0, scrollHeight });
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
    // 303px into the scroller: above its line, though below the window's, and
    // below its line if the border were counted as scroll space.
    expect(startFor(643, innerScroller(2000))).toBe("top 85%");
    expect(startFor(700, innerScroller(2000))).toBe("clamp(top 85%)");
    expect(startFor(700, innerScroller(380))).toBe("top bottom");
  });
});
