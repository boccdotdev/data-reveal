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
  // What each to() call returned.
  tweens: [] as Array<{ kill: () => void }>,
  fromTo: [] as Array<Record<string, unknown>>,
  batch: [] as Array<Record<string, unknown>>,
  set: [] as Array<Record<string, unknown>>,
  own: {} as Record<string, number>,
  // The tweens getTweensOf() reports as running on a target.
  active: [] as unknown[],
  // How many getProperty() calls asked GSAP to read the element afresh.
  uncached: 0,
  // What SplitText.create() was given, the pieces it "split" into, and its revert().
  splitVars: undefined as Record<string, unknown> | undefined,
  pieces: [] as Element[],
  splitReverted: 0,
}));
vi.mock("gsap", () => ({
  gsap: {
    registerPlugin: () => {},
    set: (_target: unknown, vars: Record<string, unknown>) => {
      recorded.set.push(vars);
    },
    getTweensOf: () => recorded.active,
    getProperty: (_target: unknown, property: string, _unit?: string, uncache?: boolean) => {
      if (uncache) recorded.uncached++;
      return recorded.own[property] ?? (property.startsWith("scale") ? 1 : 0);
    },
    to: (_target: unknown, vars: Record<string, unknown>) => {
      recorded.to.push(vars);
      const tween = { kill: vi.fn() };
      recorded.tweens.push(tween);
      return tween;
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
  SplitText: {
    // Hands back the pieces a test set up, and runs onSplit as SplitText does.
    create: (_target: unknown, vars: Record<string, unknown> & { onSplit?: (self: unknown) => unknown }) => {
      recorded.splitVars = vars;
      const pieces = recorded.pieces;
      const self = {
        chars: pieces,
        words: pieces,
        lines: pieces,
        isSplit: true,
        revert: () => {
          recorded.splitReverted++;
        },
      };
      vars.onSplit?.(self);
      return self;
    },
  },
}));

beforeEach(() => {
  recorded.to.length = 0;
  recorded.tweens.length = 0;
  recorded.fromTo.length = 0;
  recorded.batch.length = 0;
  recorded.set.length = 0;
  recorded.own = {};
  recorded.active = [];
  recorded.uncached = 0;
  recorded.splitVars = undefined;
  recorded.pieces = [];
  recorded.splitReverted = 0;
  document.body.innerHTML = "";
  // happy-dom lays nothing out, so give list items the box batch looks for
  // before it watches them. A test takes it away to stand for one without.
  HTMLLIElement.prototype.checkVisibility = () => true;
  HTMLLIElement.prototype.getBoundingClientRect = () => ({ width: 100, height: 20 }) as DOMRect;
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

describe.each(oneShot)("%s when it finishes", (name, init) => {
  // Runs the type on a target with an inline style of its own and the end
  // state GSAP would leave, then completes its tween.
  function complete(attributes: string, defaults: RevealContext["defaults"] = {}, before?: (target: HTMLElement) => void) {
    const target = element(`style="color: red;" ${attributes}`);
    // As the core does before a type's init.
    registry.snapshot(target, target);
    init(target, { reduced: false, defaults });
    const vars = recorded.to[recorded.to.length - 1];
    Object.assign(target.style, {
      opacity: "1",
      transform: "translate(0px, 0px)",
      clipPath: "inset(0px)",
      filter: "blur(0px)",
    });
    const tween = { targets: () => [target] };
    (vars.onStart as (this: unknown) => void).call(tween);
    before?.(target);
    (vars.onComplete as (this: unknown) => void).call(tween);
    return target;
  }

  it("hands the animated props back to the element's own CSS", () => {
    expect(complete("").style.cssText).toBe("color: red;");
  });

  // With `css` on the target, reports whether finishing the reveal, and
  // destroy() before it plays, told GSAP to read the transform afresh.
  function uncachedBy(css: string): { finish?: number; destroy?: number } {
    type Cached = HTMLElement & { _gsap: { uncache?: number } };
    document.head.innerHTML = `<style>#target { ${css} }</style>`;
    const finished = complete("", {}, (target) => Object.assign(target, { _gsap: {} })) as Cached;
    const waiting = element() as Cached;
    registry.snapshot(waiting, waiting);
    init(waiting, { reduced: false, defaults: {} });
    waiting._gsap = {};
    registry.killAll({ restore: "animated" });
    document.head.innerHTML = "";
    return { finish: finished._gsap.uncache, destroy: waiting._gsap.uncache };
  }

  it("makes GSAP read the element's transform afresh, after finishing and on destroy(), when its CSS sets translate, rotate or scale", () => {
    // blur and clip don't move the element, so GSAP's cache is still right.
    const moves = name !== "blur" && name !== "clip";
    for (const css of ["translate: 4px;", "rotate: 10deg;", "scale: 2;"]) {
      expect(uncachedBy(css)).toEqual(moves ? { finish: 1, destroy: 1 } : {});
    }
  });

  it("leaves GSAP's cache alone otherwise, so a site's own rotation: 270 stays 270", () => {
    expect(uncachedBy("transform: rotate(10deg);")).toEqual({});
  });

  it("stops counting as animating the element when its tween is interrupted or reversed", () => {
    for (const callback of ["onInterrupt", "onReverseComplete"]) {
      const target = element();
      registry.snapshot(target, target);
      init(target, { reduced: false, defaults: {} });
      const vars = recorded.to[recorded.to.length - 1];
      const tween = { targets: () => [target] };
      (vars.onStart as (this: unknown) => void).call(tween);
      expect(registry.animating(target)).toBe(true);
      (vars[callback] as (this: unknown) => void).call(tween);
      expect(registry.animating(target)).toBe(false);
    }
  });

  it("leaves them while another reveal is still animating the element", () => {
    const other = document.createElement("ul");
    const target = complete("", {}, (target) => registry.started(other, target));
    expect(target.style.transform).toBe("translate(0px, 0px)");
  });

  it("isn't held up by a tween of the site's own on the element", () => {
    // getTweensOf() reports a site tween; only the package's own reveals count.
    recorded.active = [{ site: "tween" }];
    expect(complete("").style.cssText).toBe("color: red;");
  });

  it("animates to the element's own opacity, so handing it back doesn't jump", () => {
    document.head.innerHTML = `<style>.muted { opacity: 0.6; }</style>`;
    const vars = run(init, 'class="muted"');
    document.head.innerHTML = "";
    // clip doesn't animate opacity at all.
    if (!("opacity" in vars)) return;
    expect(vars.opacity).toBe(0.6);
    // Nor past it, on the way, with an ease that overshoots.
    const cap = (vars.modifiers as { opacity: (value: string, target: Element) => number }).opacity;
    expect(cap("0.64", document.body)).toBe(0.6);
    expect(cap("0.3", document.body)).toBe(0.3);
  });

  it("puts GSAP's record of a plain element's transform back on destroy(), but not when it finishes", () => {
    // blur and clip don't read or move the transform.
    if (name === "blur" || name === "clip") return;
    registry.killAll();
    complete("");
    const finished = recorded.set.length;
    registry.killAll({ restore: "animated" });
    expect(recorded.set.length).toBe(finished);

    const waiting = element();
    registry.snapshot(waiting, waiting);
    init(waiting, { reduced: false, defaults: {} });
    const armed = recorded.set.length;
    registry.killAll({ restore: "animated" });
    expect(recorded.set.slice(armed)).toEqual([expect.objectContaining({ x: 0, y: 0, rotation: 0, scaleX: 1 })]);
  });

  it("keeps its end state with reverse or keep", () => {
    expect(complete("data-reveal-reverse").style.transform).toBe("translate(0px, 0px)");
    expect(complete("data-reveal-keep").style.transform).toBe("translate(0px, 0px)");
    expect(complete("", { keep: true }).style.transform).toBe("translate(0px, 0px)");
  });
});

describe("split", () => {
  function splitInto(attributes: string, defaults: RevealContext["defaults"] = {}): HTMLElement {
    html(`<div id="target" ${attributes}><span id="one">Hello</span> <span id="two">there</span></div>`);
    const target = document.getElementById("target") as HTMLElement;
    recorded.pieces = Array.from(target.querySelectorAll("span"));
    registry.snapshot(target, target);
    split(target, { reduced: false, defaults });
    return target;
  }

  it("re-splits on resize and font loading", () => {
    splitInto('data-reveal-split="lines"');
    expect(recorded.splitVars?.autoSplit).toBe(true);
  });

  it("puts a hidden copy of each word in front of it, for chars by default", () => {
    const target = splitInto("");
    expect(recorded.splitVars?.aria).toBe("none");
    for (const id of ["one", "two"]) {
      const piece = document.getElementById(id) as HTMLElement;
      expect(piece.getAttribute("aria-hidden")).toBe("true");
      expect(piece.previousElementSibling?.textContent).toBe(piece.textContent);
    }
    expect(target.hasAttribute("aria-label")).toBe(false);
  });

  it("leaves words and lines to be read as they are", () => {
    for (const type of ["words", "lines"]) {
      splitInto(`data-reveal-split="${type}"`);
      expect(recorded.splitVars?.aria).toBe("none");
      expect(document.querySelector("[aria-hidden]")).toBeNull();
    }
  });

  it("takes aria from the attribute or the defaults", () => {
    splitInto('data-reveal-aria="auto"');
    expect(recorded.splitVars?.aria).toBe("auto");
    splitInto('data-reveal-split="words"', { aria: "hidden" });
    expect(document.getElementById("one")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("stops waiting on fonts once a play-once lines split finishes", () => {
    // happy-dom has no font set.
    const fonts = { addEventListener: vi.fn(), removeEventListener: vi.fn(), ready: Promise.resolve() };
    Object.defineProperty(document, "fonts", { value: fonts, configurable: true });
    try {
      const target = splitInto('data-reveal-split="lines"');
      const listener = fonts.addEventListener.mock.calls[0]?.[1];
      expect(listener).toBeTypeOf("function");
      const vars = recorded.to[recorded.to.length - 1];
      const tween = { targets: () => recorded.pieces };
      (vars.onStart as (this: unknown) => void).call(tween);
      (vars.onComplete as (this: unknown) => void).call(tween);
      expect(fonts.removeEventListener).toHaveBeenCalledWith("loading", listener);
      registry.kill(target);
    } finally {
      delete (document as { fonts?: unknown }).fonts;
    }
  });

  it("reverts a finished play-once split, but not one that keeps its end state", () => {
    for (const [attributes, reverted] of [["", 1], ["data-reveal-keep", 0]] as const) {
      recorded.splitReverted = 0;
      const target = splitInto(attributes);
      const vars = recorded.to[recorded.to.length - 1];
      const tween = { targets: () => recorded.pieces };
      (vars.onStart as (this: unknown) => void).call(tween);
      (vars.onComplete as (this: unknown) => void).call(tween);
      expect(recorded.splitReverted).toBe(reverted);
      expect(registry.animating(target)).toBe(false);
    }
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
  it("is read from GSAP's cache on a first reveal, and afresh on a re-init", () => {
    const target = element();
    registry.snapshot(target, target);
    fade(target, { reduced: false, defaults: {} });
    expect(recorded.uncached).toBe(0);

    registry.killAll({ restore: "animated" });
    registry.snapshot(target, target);
    fade(target, { reduced: false, defaults: {} });
    expect(recorded.uncached).toBeGreaterThan(0);
  });

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
    (callback as (group: Element[]) => void)([document.querySelector("li") as Element]);
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
    tween.stagger.onComplete.call(itemTween);
    expect(item.hasAttribute("style")).toBe(false);
  });

  it("animates each item to its own opacity", () => {
    document.head.innerHTML = `<style>.muted { opacity: 0.6; }</style>`;
    html(`<ul id="list"><li id="plain">one</li><li id="muted" class="muted">two</li></ul>`);
    batch(document.getElementById("list") as HTMLElement, { reduced: false, defaults: {} });
    document.head.innerHTML = "";
    const vars = recorded.batch[recorded.batch.length - 1] as Vars;
    (vars.onEnter as (group: Element[]) => void)(Array.from(document.querySelectorAll("li")));
    const opacity = recorded.to[recorded.to.length - 1].opacity as (index: number, item: Element) => number;

    expect(opacity(0, document.getElementById("plain") as Element)).toBe(1);
    expect(opacity(1, document.getElementById("muted") as Element)).toBe(0.6);
  });

  it("keeps the items' end state with reverse or keep", () => {
    for (const attributes of ["data-reveal-reverse", "data-reveal-keep"]) {
      const vars = batchVars(attributes);
      const item = document.querySelector("li") as HTMLElement;
      (vars.onEnter as (group: Element[]) => void)([item]);
      const tween = recorded.to[recorded.to.length - 1] as { stagger: { onComplete: (this: unknown) => void } };
      item.style.transform = "translate(0px, 0px)";

      tween.stagger.onComplete.call({ targets: () => [item] });
      expect(item.style.transform).toBe("translate(0px, 0px)");
    }
  });

  it("stops every group still animating on destroy(), not just the latest", () => {
    registry.killAll();
    const vars = batchVars("data-reveal-reverse");
    const item = document.querySelector("li") as HTMLElement;
    const enter = vars.onEnter as (group: Element[]) => void;
    const leave = vars.onLeaveBack as (group: Element[]) => void;
    enter([item]);
    leave([item]);
    enter([item]);
    const groups = [...recorded.tweens];

    registry.killAll({ restore: "animated" });
    expect(groups).toHaveLength(3);
    for (const tween of groups) expect(tween.kill).toHaveBeenCalled();
  });

  it("lets a group's tween go once it completes or is interrupted", () => {
    for (const callback of ["onComplete", "onInterrupt"]) {
      registry.killAll();
      const vars = batchVars();
      (vars.onEnter as (group: Element[]) => void)([document.querySelector("li") as Element]);
      const tween = recorded.tweens[recorded.tweens.length - 1];
      (recorded.to[recorded.to.length - 1][callback] as (this: unknown) => void).call(tween);

      registry.killAll();
      expect(tween.kill).not.toHaveBeenCalled();
    }
  });

  it("takes items over from its own earlier tweens, never with GSAP's overwrite, which would kill another reveal's", () => {
    registry.killAll();
    const vars = batchVars("data-reveal-reverse");
    const item = document.querySelector("li") as HTMLElement;
    (vars.onEnter as (group: Element[]) => void)([item]);
    const first = recorded.tweens[recorded.tweens.length - 1];
    (vars.onLeaveBack as (group: Element[]) => void)([item]);

    expect(first.kill).toHaveBeenCalledWith([item]);
    for (const tween of recorded.to.slice(-2)) expect(tween.overwrite).toBeUndefined();
  });

  it("after printing, leaves an item a newer tween took over while printing, and puts the rest back", () => {
    registry.killAll();
    html(`<ul id="list" data-reveal-reverse><li id="one">one</li><li id="two">two</li></ul>`);
    const list = document.getElementById("list") as HTMLElement;
    registry.snapshot(list, list);
    batch(list, { reduced: false, defaults: {} });
    const vars = recorded.batch[recorded.batch.length - 1] as Vars;

    registry.print(() => true, "before");
    // Scrolled while printing: the first item enters with a tween of its own.
    (vars.onEnter as (group: Element[]) => void)([document.getElementById("one") as Element]);
    const setBefore = recorded.set.length;
    registry.print(() => true, "after");
    const putBack = recorded.set.slice(setBefore).map((vars) => Object.keys(vars).sort().join());
    expect(putBack).toEqual(["opacity,y"]);
    expect(document.getElementById("one")?.hasAttribute("data-reveal-pending")).toBe(false);
    expect(document.getElementById("two")?.hasAttribute("data-reveal-pending")).toBe(true);
  });

  it("uses the built-in start unless one is set", () => {
    expect(batchVars().start).toBe(defaultStart);
    expect(batchVars("", { start: "top 75%" }).start).toBe("top 75%");
  });
});

describe("when reveals finish (#56, #57)", () => {
  type Callbacks = Record<string, ((this: unknown, ...args: unknown[]) => void) | undefined>;
  const ctx = (reduced = false): RevealContext => ({ reduced, defaults: {} });

  // Arms a type on a fresh element, as the core does.
  function arm(init: RevealInit, attributes = "", reduced = false): HTMLElement {
    const target = element(attributes);
    recorded.pieces = [];
    registry.snapshot(target, target);
    init(target, ctx(reduced));
    return target;
  }

  // Plays the tween the type just built to its end, as GSAP would.
  function playOut(target: HTMLElement): void {
    const vars = recorded.to[recorded.to.length - 1] as Callbacks;
    const tween = { targets: () => [target] };
    vars.onStart?.call(tween);
    vars.onComplete?.call(tween);
  }

  // Arms a batch of two items and returns them with a function that plays one out.
  function armBatch(attributes = "") {
    html(`<ul id="list" ${attributes}><li>one</li><li>two</li></ul>`);
    const list = document.getElementById("list") as HTMLElement;
    const items = Array.from(list.children) as HTMLElement[];
    registry.snapshot(list, list);
    batch(list, ctx());
    (recorded.batch[recorded.batch.length - 1].onEnter as (group: Element[]) => void)(items);
    const { stagger } = recorded.to[recorded.to.length - 1] as { stagger: Callbacks };
    const finish = (item: HTMLElement) => {
      stagger.onStart?.call({ targets: () => [item] });
      stagger.onComplete?.call({ targets: () => [item] });
    };
    return { list, items, finish };
  }

  const state = (target: Element) => target.getAttribute("data-reveal-state");

  it("leaves the registry empty once every play-once reveal has finished, each marked done", () => {
    registry.killAll();
    const done: HTMLElement[] = [];
    for (const init of [fade, scale, blur, clip, rotate, slide, counter, split]) {
      const target = arm(init);
      playOut(target);
      done.push(target);
    }
    const { list, items, finish } = armBatch();
    items.forEach(finish);
    done.push(list);

    expect(registry.size).toBe(0);
    for (const target of done) expect(state(target)).toBe("done");
  });

  it("marks a batch done, and lets it go, once its last item has finished", () => {
    registry.killAll();
    const { list, items, finish } = armBatch();
    finish(items[0]);
    expect(registry.size).toBe(1);
    expect(state(list)).toBeNull();

    finish(items[1]);
    expect(registry.size).toBe(0);
    expect(state(list)).toBe("done");
  });

  it("keeps a reveal with keep, marked done, so destroy() can still put it back", () => {
    for (const init of [fade, split]) {
      registry.killAll();
      playOut(arm(init, "data-reveal-keep"));
      expect(registry.size).toBe(1);
    }
    registry.killAll();
    const { list, items, finish } = armBatch("data-reveal-keep");
    items.forEach(finish);
    expect(registry.size).toBe(1);
    expect(state(list)).toBe("done");
  });

  it("keeps a reveal with reverse, never marked done, since it plays again", () => {
    for (const init of [fade, counter, split]) {
      registry.killAll();
      const target = arm(init, "data-reveal-reverse");
      playOut(target);
      expect(registry.size).toBe(1);
      expect(state(target)).toBeNull();
    }
  });

  it("leaves an element another reveal is already animating to it, and is done once that one is", () => {
    registry.killAll();
    const other = document.createElement("ul");
    const target = arm(fade);
    registry.snapshot(other, target);
    registry.started(other, target);
    const vars = recorded.to[recorded.to.length - 1] as Callbacks;
    const tween = { targets: () => [target], kill: vi.fn() };
    vars.onStart?.call(tween);
    expect(tween.kill).toHaveBeenCalled();
    expect(registry.animating(target)).toBe(true);

    registry.stopped(other, target);
    expect(state(target)).toBeNull();
    registry.settle(target);
    expect(state(target)).toBe("done");
  });

  it("isn't done, nor hands back, while another reveal is still animating the element", () => {
    registry.killAll();
    const other = document.createElement("ul");
    const target = arm(fade);
    registry.snapshot(other, target);
    const vars = recorded.to[recorded.to.length - 1] as Callbacks;
    const tween = { targets: () => [target] };
    vars.onStart?.call(tween);
    registry.started(other, target);
    target.style.opacity = "0.5";
    vars.onComplete?.call(tween);
    expect(state(target)).toBeNull();
    expect(target.style.opacity).toBe("0.5");

    registry.stopped(other, target);
    registry.settle(target);
    expect(state(target)).toBe("done");
  });

  it("marks a play-once reveal done straight away under reduced motion, but not reverse or parallax", () => {
    registry.killAll();
    for (const init of [fade, counter, split]) expect(state(arm(init, "", true))).toBe("done");
    expect(registry.size).toBe(0);
    expect(state(arm(fade, "data-reveal-reverse", true))).toBeNull();
    expect(state(arm(parallax, "", true))).toBeNull();
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
