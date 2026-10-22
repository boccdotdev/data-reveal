import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RevealDefaults, RevealInit } from "../../src/internal/types";
import { deferred, el, fakeType, html, loadCore, settle, state } from "./helpers";

const scrollTrigger = { refresh: vi.fn(), triggers: 1, fail: false, listeners: new Set<() => void>() };

// What ScrollTrigger does once a refresh has run.
function refreshed(): void {
  scrollTrigger.listeners.forEach((listener) => listener());
}

// Frames queue up here instead of running, so a refresh one test schedules
// can't land in another, and a test runs them when it's ready.
let frames: FrameRequestCallback[] = [];
function runFrames(): void {
  const queued = frames;
  frames = [];
  queued.forEach((callback) => callback(0));
}

beforeEach(() => {
  scrollTrigger.refresh.mockClear();
  scrollTrigger.triggers = 1;
  scrollTrigger.fail = false;
  scrollTrigger.listeners.clear();
  // Registered per test, so a module one test loaded isn't reused by the next.
  vi.doMock("gsap/ScrollTrigger", () => {
    if (scrollTrigger.fail) throw new Error("ScrollTrigger chunk is gone");
    return {
      ScrollTrigger: {
        refresh: scrollTrigger.refresh,
        getAll: () => Array(scrollTrigger.triggers).fill({}),
        addEventListener: (_type: string, listener: () => void) => scrollTrigger.listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => scrollTrigger.listeners.delete(listener),
      },
    };
  });
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

afterEach(async () => {
  // Let a refresh this test scheduled reach requestAnimationFrame now, so it
  // lands in this test's queue rather than the next one's.
  await import("gsap/ScrollTrigger").catch(() => {});
  await settle();
  vi.unstubAllGlobals();
});

describe("init()", () => {
  it("marks every element it handles ready, skipped or failed", async () => {
    const { createRevealCore, registry } = await loadCore();
    const fade = fakeType(registry);
    const chunkError = new Error("chunk failed");
    const reveal = createRevealCore((type) => {
      if (type === "fade") return fade.init;
      if (type === "broken") return Promise.reject(chunkError);
      return null;
    });
    html(`
      <div id="ready" data-reveal="fade"></div>
      <div id="unknown" data-reveal="nope"></div>
      <div id="bare" data-reveal></div>
      <div id="broken" data-reveal="broken"></div>
    `);

    await expect(reveal.init()).rejects.toBe(chunkError);
    expect(state("ready")).toBe("ready");
    expect(state("unknown")).toBe("skipped");
    expect(state("bare")).toBe("skipped");
    expect(state("broken")).toBe("failed");
  });

  it("arms each element once, however often it's called", async () => {
    const { createRevealCore, registry } = await loadCore();
    const fade = fakeType(registry);
    const resolve = vi.fn(() => fade.init);
    const reveal = createRevealCore(resolve);
    html(`<div id="a" data-reveal="fade"></div>`);

    await reveal.init();
    await reveal.init();
    expect(fade.armed).toEqual([el("a")]);
    expect(resolve).toHaveBeenCalledTimes(1);

    document.body.insertAdjacentHTML("beforeend", `<div id="b" data-reveal="fade"></div>`);
    await reveal.init();
    expect(fade.armed).toEqual([el("a"), el("b")]);
  });

  it("passes reduced motion through to each type", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
    const { createRevealCore } = await loadCore();
    const init = vi.fn<RevealInit>();
    const reveal = createRevealCore(() => init);
    html(`<div id="a" data-reveal="fade"></div>`);

    await reveal.init();
    expect(init).toHaveBeenCalledWith(el("a"), { reduced: true, defaults: {} });
  });

  it("arms each type as soon as it resolves", async () => {
    const { createRevealCore, registry } = await loadCore();
    const fade = fakeType(registry);
    const split = fakeType(registry);
    const slow = deferred<RevealInit>();
    const reveal = createRevealCore((type) => (type === "split" ? slow.promise : fade.init));
    html(`<h2 id="slow" data-reveal="split"></h2><div id="fast" data-reveal="fade"></div>`);

    let settled = false;
    const done = reveal.init().then(() => (settled = true));
    await settle();
    expect(state("fast")).toBe("ready");
    expect(state("slow")).toBeNull();
    expect(settled).toBe(false);

    slow.resolve(split.init);
    await done;
    expect(state("slow")).toBe("ready");
  });

  it("runs the other types when one fails, then rejects with the first error in DOM order", async () => {
    const { createRevealCore, registry } = await loadCore();
    const fade = fakeType(registry);
    const slow = deferred<RevealInit>();
    const firstError = new Error("first");
    const secondError = new Error("second");
    const reveal = createRevealCore((type) => {
      if (type === "slow") return slow.promise;
      if (type === "first") return Promise.reject(firstError);
      if (type === "second") return Promise.reject(secondError);
      return fade.init;
    });
    html(`
      <div id="fast" data-reveal="fade"></div>
      <div id="slow" data-reveal="slow"></div>
      <div id="first" data-reveal="first"></div>
      <div id="second" data-reveal="second"></div>
    `);

    let outcome: unknown = "pending";
    const done = reveal.init().then(
      () => (outcome = "resolved"),
      (error) => (outcome = error),
    );
    await settle();
    expect(state("fast")).toBe("ready");
    expect(state("first")).toBe("failed");
    expect(state("second")).toBe("failed");
    expect(outcome).toBe("pending");

    slow.resolve(fade.init);
    await done;
    expect(state("slow")).toBe("ready");
    expect(outcome).toBe(firstError);
  });

  it("releases failed elements so a later init() tries them again", async () => {
    const { createRevealCore, registry } = await loadCore();
    const fade = fakeType(registry);
    const chunkError = new Error("chunk failed");
    const resolve = vi
      .fn<(type: string) => Promise<RevealInit>>()
      .mockRejectedValueOnce(chunkError)
      .mockResolvedValue(fade.init);
    const reveal = createRevealCore(resolve);
    html(`<div id="a" data-reveal="fade"></div>`);

    await expect(reveal.init()).rejects.toBe(chunkError);
    expect(state("a")).toBe("failed");

    await reveal.init();
    expect(state("a")).toBe("ready");
    expect(fade.armed).toEqual([el("a")]);
  });

  it("doesn't overwrite another instance's state with skipped", async () => {
    const { createRevealCore, registry } = await loadCore();
    const fade = fakeType(registry);
    const split = fakeType(registry);
    const fadeOnly = createRevealCore((type) => (type === "fade" ? fade.init : null));
    const splitOnly = createRevealCore((type) => (type === "split" ? split.init : null));
    html(`<div id="a" data-reveal="fade"></div><h2 id="b" data-reveal="split"></h2>`);

    await splitOnly.init();
    await fadeOnly.init();
    expect(state("a")).toBe("ready");
    expect(state("b")).toBe("ready");
  });

  it("hands each type the defaults with its own typeDefaults over them", async () => {
    const { createRevealCore } = await loadCore();
    const init = vi.fn<RevealInit>();
    const reveal = createRevealCore(() => init, {
      defaults: { duration: 1, ease: "power2.out" },
      // An unset key doesn't hide the global value.
      typeDefaults: { fade: { duration: 0.2, ease: undefined } },
    });
    html(`<div id="a" data-reveal="fade"></div><div id="b" data-reveal="scale"></div>`);

    await reveal.init();
    expect(init).toHaveBeenCalledWith(el("a"), { reduced: false, defaults: { duration: 0.2, ease: "power2.out" } });
    expect(init).toHaveBeenCalledWith(el("b"), { reduced: false, defaults: { duration: 1, ease: "power2.out" } });
  });

  describe("global defaults a type would misread", () => {
    const global = { start: "top 75%", end: "bottom 50%", duration: 0.35, stagger: 0.08, from: 100, ease: "back.out(2)" };

    async function defaultsByType(typeDefaults?: RevealDefaults["typeDefaults"]) {
      const { createRevealCore } = await loadCore();
      const init = vi.fn<RevealInit>();
      const reveal = createRevealCore(() => init, { defaults: global, typeDefaults });
      html(`
        <div id="fade" data-reveal="fade"></div>
        <div id="parallax" data-reveal="parallax"></div>
        <div id="counter" data-reveal="counter"></div>
        <div id="scale" data-reveal="scale"></div>
        <h2 id="split" data-reveal="split"></h2>
      `);
      await reveal.init();
      return (id: string) => init.mock.calls.find(([target]) => target.id === id)?.[1].defaults;
    }

    it("are left out: start and end for parallax, duration, from and ease for counter, from for scale, stagger for split", async () => {
      const defaultsOf = await defaultsByType();
      const without = (...keys: string[]) =>
        Object.fromEntries(Object.entries(global).filter(([key]) => !keys.includes(key)));
      expect(defaultsOf("fade")).toEqual(global);
      expect(defaultsOf("parallax")).toEqual(without("start", "end"));
      expect(defaultsOf("counter")).toEqual(without("duration", "from", "ease"));
      expect(defaultsOf("scale")).toEqual(without("from"));
      expect(defaultsOf("split")).toEqual(without("stagger"));
    });

    it("still apply from typeDefaults", async () => {
      const defaultsOf = await defaultsByType({
        parallax: { start: "top 90%", end: "bottom 10%" },
        counter: { duration: 2, from: 5, ease: "none" },
        scale: { from: 0.5 },
        split: { stagger: 0.01 },
      });
      expect(defaultsOf("parallax")).toMatchObject({ start: "top 90%", end: "bottom 10%" });
      expect(defaultsOf("counter")).toMatchObject({ duration: 2, from: 5, ease: "none" });
      expect(defaultsOf("scale")).toMatchObject({ from: 0.5 });
      expect(defaultsOf("split")).toMatchObject({ stagger: 0.01 });
    });
  });

  it("reads defaults and typeDefaults by the same rules as attributes", async () => {
    const { createRevealCore } = await loadCore();
    const init = vi.fn<RevealInit>();
    // As they might arrive from JSON or a CMS field.
    const loose = {
      defaults: { start: "", reverse: "false", duration: "0.5", ease: 3, separator: "" },
      typeDefaults: { fade: { to: "1,200", delay: "soon" } },
    } as unknown as RevealDefaults;
    const reveal = createRevealCore(() => init, loose);
    html(`<div id="a" data-reveal="fade"></div>`);

    await reveal.init();
    expect(init.mock.calls[0][1].defaults).toEqual({ reverse: false, duration: 0.5, separator: "", to: 1200 });
  });

  it("includes the container itself (#10)", async () => {
    const { createRevealCore, registry } = await loadCore();
    const fade = fakeType(registry);
    const reveal = createRevealCore(() => fade.init);
    html(`<section id="card" data-reveal="fade"><p id="inner" data-reveal="fade"></p></section>`);

    await reveal.init(el("card"));
    expect(fade.armed).toEqual([el("card"), el("inner")]);
    expect(state("card")).toBe("ready");
  });
});

describe("init() when a type's init throws", () => {
  it("undoes that element's registered work and inline styles, and leaves nested reveals running", async () => {
    const { createRevealCore, registry } = await loadCore();
    const fade = fakeType(registry);
    const thrown = new Error("init threw");
    const order: string[] = [];
    const killThrowing = vi.fn();
    const throwing: RevealInit = (target) => {
      order.push(`throwing:${target.id}`);
      registry.add(target, { kill: killThrowing });
      target.style.opacity = "0";
      target.style.transform = "translateY(20px)";
      throw thrown;
    };
    const reveal = createRevealCore((type) => (type === "boom" ? throwing : fade.init));
    const fadeInit = fade.init;
    fade.init = (target, ctx) => {
      order.push(`fade:${target.id}`);
      fadeInit(target, ctx);
    };
    html(`
      <div id="first" data-reveal="fade"></div>
      <div id="outer" data-reveal="boom" style="color: red;">
        <div id="inner" data-reveal="fade"></div>
      </div>
      <div id="after" data-reveal="fade"></div>
    `);

    await expect(reveal.init()).rejects.toBe(thrown);
    // The nested reveal was armed before its parent threw.
    expect(order).toEqual(["fade:first", "fade:inner", "fade:after", "throwing:outer"]);
    expect(killThrowing).toHaveBeenCalledTimes(1);
    expect(fade.kills.get(el("inner"))).not.toHaveBeenCalled();
    expect(el("outer").getAttribute("style")).toBe("color: red;");
    expect(state("outer")).toBe("failed");
    expect(state("inner")).toBe("ready");
    expect(state("after")).toBe("ready");
  });

  it("removes a style attribute the element didn't have", async () => {
    const { createRevealCore } = await loadCore();
    const reveal = createRevealCore(() => (target) => {
      target.style.opacity = "0";
      throw new Error("init threw");
    });
    html(`<div id="a" data-reveal="fade"></div>`);

    await expect(reveal.init()).rejects.toThrow("init threw");
    expect(el("a").hasAttribute("style")).toBe(false);
  });
});

describe("destroy() during a pending init() (#11)", () => {
  it("init(); destroy(); init() arms each element once", async () => {
    const { createRevealCore, registry } = await loadCore();
    const fade = fakeType(registry);
    const load = deferred<RevealInit>();
    const reveal = createRevealCore(() => load.promise);
    html(`<div id="a" data-reveal="fade"></div><div id="b" data-reveal="fade"></div>`);

    const first = reveal.init();
    reveal.destroy();
    const second = reveal.init();
    load.resolve(fade.init);
    await Promise.all([first, second]);
    expect(fade.armed).toEqual([el("a"), el("b")]);
  });

  it("drops the destroyed subtree from the pending call, and init() can arm it later", async () => {
    const { createRevealCore, registry } = await loadCore();
    const fade = fakeType(registry);
    const load = deferred<RevealInit>();
    const reveal = createRevealCore(() => load.promise);
    html(`<section id="swap"><div id="inside" data-reveal="fade"></div></section><div id="outside" data-reveal="fade"></div>`);

    const pending = reveal.init();
    reveal.destroy(el("swap"));
    load.resolve(fade.init);
    await pending;
    expect(fade.armed).toEqual([el("outside")]);
    expect(state("inside")).toBeNull();

    await reveal.init(el("swap"));
    expect(fade.armed).toEqual([el("outside"), el("inside")]);
  });

  it("doesn't let a stale call release the claim a newer call made", async () => {
    const { createRevealCore, registry } = await loadCore();
    const fade = fakeType(registry);
    const staleLoad = deferred<RevealInit>();
    const chunkError = new Error("stale chunk failed");
    const resolve = vi
      .fn<(type: string) => Promise<RevealInit> | RevealInit>()
      .mockReturnValueOnce(staleLoad.promise)
      .mockReturnValue(fade.init);
    const reveal = createRevealCore(resolve);
    html(`<div id="a" data-reveal="fade"></div>`);

    const stale = reveal.init().catch((error: unknown) => error);
    reveal.destroy();
    await reveal.init();
    expect(state("a")).toBe("ready");

    staleLoad.reject(chunkError);
    expect(await stale).toBe(chunkError);
    expect(state("a")).toBe("ready");

    await reveal.init();
    expect(fade.armed).toEqual([el("a")]);
  });
});

describe("init() and the page", () => {
  it("arms a detached subtree, so init() can run before it's inserted", async () => {
    const { createRevealCore, registry } = await loadCore();
    const fade = fakeType(registry);
    const reveal = createRevealCore(() => fade.init);
    const card = document.createElement("div");
    card.id = "card";
    card.dataset.reveal = "fade";

    await reveal.init(card);
    document.body.append(card);
    expect(fade.armed).toEqual([card]);
    expect(state("card")).toBe("ready");

    await reveal.init();
    expect(fade.armed).toEqual([card]);
  });

  it("skips an element removed while its type loads, and arms it once it's back", async () => {
    const { createRevealCore, registry } = await loadCore();
    const fade = fakeType(registry);
    const load = deferred<RevealInit>();
    const resolve = vi.fn().mockReturnValueOnce(load.promise).mockReturnValue(fade.init);
    const reveal = createRevealCore(resolve);
    html(`<div id="a" data-reveal="fade"></div><div id="b" data-reveal="fade"></div>`);
    const b = el("b");

    const pending = reveal.init();
    b.remove();
    load.resolve(fade.init);
    await pending;
    expect(fade.armed).toEqual([el("a")]);
    expect(b.hasAttribute("data-reveal-state")).toBe(false);

    document.body.append(b);
    await reveal.init();
    expect(fade.armed).toEqual([el("a"), b]);
  });

  it("resolves without waiting for elements an earlier call is still loading", async () => {
    const { createRevealCore, registry } = await loadCore();
    const fade = fakeType(registry);
    const resolve = vi.fn((type: string) => (type === "split" ? new Promise<RevealInit>(() => {}) : fade.init));
    const reveal = createRevealCore(resolve);
    html(`<h2 id="hung" data-reveal="split"></h2>`);

    void reveal.init();
    document.body.insertAdjacentHTML("beforeend", `<div id="added" data-reveal="fade"></div>`);
    const outcome = await Promise.race([
      reveal.init().then(() => "resolved"),
      settle(200).then(() => "still waiting"),
    ]);
    expect(outcome).toBe("resolved");
    expect(state("added")).toBe("ready");
    // The hung element still belongs to the first call.
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(state("hung")).toBeNull();
  });
});

describe("visibility under a site's own pre-hide", () => {
  beforeEach(() => {
    document.head.innerHTML = `<style>[data-reveal] { opacity: 0; } .muted { opacity: 0.6; }</style>`;
  });

  it("shows skipped and failed elements", async () => {
    const { createRevealCore } = await loadCore();
    const reveal = createRevealCore((type) => {
      if (type === "broken") return Promise.reject(new Error("chunk failed"));
      if (type === "boom") {
        return () => {
          throw new Error("init threw");
        };
      }
      return null;
    });
    html(`
      <div id="skipped" data-reveal="nope"></div>
      <div id="failed-load" data-reveal="broken"></div>
      <div id="failed-init" data-reveal="boom"></div>
      <div id="muted" class="muted" data-reveal="nope"></div>
    `);

    await reveal.init().catch(() => {});
    expect(getComputedStyle(el("skipped")).opacity).toBe("1");
    expect(getComputedStyle(el("failed-load")).opacity).toBe("1");
    expect(getComputedStyle(el("failed-init")).opacity).toBe("1");
    // Its own opacity isn't 0, so it's left alone.
    expect(el("muted").style.opacity).toBe("");
  });
});

describe("destroy()", () => {
  it("with a container, kills only that subtree and lets init() re-arm it", async () => {
    const { createRevealCore, registry } = await loadCore();
    const fade = fakeType(registry);
    const reveal = createRevealCore(() => fade.init);
    html(`<section id="swap" data-reveal="fade"><div id="inside" data-reveal="fade"></div></section><div id="outside" data-reveal="fade"></div>`);
    await reveal.init();
    const [swap, inside, outside] = [el("swap"), el("inside"), el("outside")];

    reveal.destroy(swap);
    expect(fade.kills.get(swap)).toHaveBeenCalledTimes(1);
    expect(fade.kills.get(inside)).toHaveBeenCalledTimes(1);
    expect(fade.kills.get(outside)).not.toHaveBeenCalled();
    // The state stays, so reveal.css doesn't hide torn-down content.
    expect(state("inside")).toBe("ready");

    await reveal.init();
    expect(fade.armed).toEqual([swap, inside, outside, swap, inside]);
  });

  it("with no argument, kills everything and forgets every element", async () => {
    const { createRevealCore, registry } = await loadCore();
    const fade = fakeType(registry);
    const reveal = createRevealCore(() => fade.init);
    html(`<div id="a" data-reveal="fade"></div><div id="b" data-reveal="fade"></div>`);
    await reveal.init();

    reveal.destroy();
    expect(fade.kills.get(el("a"))).toHaveBeenCalledTimes(1);
    expect(fade.kills.get(el("b"))).toHaveBeenCalledTimes(1);

    await reveal.init();
    expect(fade.armed).toEqual([el("a"), el("b"), el("a"), el("b")]);
  });
});

describe("two instances on one page (#54)", () => {
  async function setup() {
    const { createRevealCore, registry } = await loadCore();
    const fade = fakeType(registry);
    const scale = fakeType(registry);
    const a = createRevealCore((type) => (type === "fade" ? fade.init : null));
    const b = createRevealCore((type) => (type === "scale" ? scale.init : null));
    html(`
      <section id="swap"><div id="fade" data-reveal="fade"></div><div id="scale" data-reveal="scale"></div></section>
      <div id="outside" data-reveal="scale"></div>
    `);
    await a.init();
    await b.init();
    return { a, b, fade, scale };
  }

  it("destroy() kills only the reveals its own instance armed", async () => {
    const { a, b, fade, scale } = await setup();

    a.destroy();
    expect(fade.kills.get(el("fade"))).toHaveBeenCalledTimes(1);
    expect(scale.kills.get(el("scale"))).not.toHaveBeenCalled();
    expect(scale.kills.get(el("outside"))).not.toHaveBeenCalled();
    expect(state("scale")).toBe("ready");

    // B still owns its elements, and a later init() doesn't arm them twice.
    await b.init();
    expect(scale.armed).toEqual([el("scale"), el("outside")]);
    b.destroy();
    expect(scale.kills.get(el("scale"))).toHaveBeenCalledTimes(1);
  });

  it("destroy(container) does the same for a subtree", async () => {
    const { a, b, fade, scale } = await setup();

    a.destroy(el("swap"));
    expect(fade.kills.get(el("fade"))).toHaveBeenCalledTimes(1);
    expect(scale.kills.get(el("scale"))).not.toHaveBeenCalled();

    b.destroy(el("swap"));
    expect(scale.kills.get(el("scale"))).toHaveBeenCalledTimes(1);
    expect(scale.kills.get(el("outside"))).not.toHaveBeenCalled();
  });

  it("doesn't arm an element a separately bundled copy of the package has armed", async () => {
    // Each copy has its own module state and registry.
    const one = await loadCore();
    const two = await loadCore();
    const first = fakeType(one.registry);
    const second = fakeType(two.registry);
    const a = one.createRevealCore(() => first.init);
    const b = two.createRevealCore(() => second.init);
    html(`<div id="x" data-reveal="fade"></div>`);

    await a.init();
    await b.init();
    expect(second.armed).toEqual([]);

    a.destroy();
    await b.init();
    expect(second.armed).toEqual([el("x")]);
  });

  it("doesn't arm an element another instance has armed, until that one destroys it", async () => {
    const { createRevealCore, registry } = await loadCore();
    const first = fakeType(registry);
    const second = fakeType(registry);
    const a = createRevealCore(() => first.init);
    const b = createRevealCore(() => second.init);
    html(`<div id="x" data-reveal="fade"></div>`);

    await a.init();
    await b.init();
    expect(second.armed).toEqual([]);

    a.destroy();
    await b.init();
    expect(second.armed).toEqual([el("x")]);
    // Now it's B's, so A leaves it alone.
    await a.init();
    expect(first.armed).toEqual([el("x")]);
  });
});

describe("printing (#15)", () => {
  it("shows the instance's reveals at their end before printing, puts back what plays again after, and stops listening on a bare destroy()", async () => {
    const { createRevealCore, registry } = await loadCore();
    const printed: string[] = [];
    const reveal = createRevealCore(() => (el) => {
      registry.add(el, { kill: () => {} });
      registry.onPrint(el, { before: () => printed.push(`before ${el.id}`), after: () => printed.push(`after ${el.id}`) });
    });
    html(`<div id="a" data-reveal="fade"></div>`);
    await reveal.init();

    // A second beforeprint before afterprint changes nothing.
    window.dispatchEvent(new Event("beforeprint"));
    window.dispatchEvent(new Event("beforeprint"));
    window.dispatchEvent(new Event("afterprint"));
    window.dispatchEvent(new Event("afterprint"));
    expect(printed).toEqual(["before a", "after a"]);

    reveal.destroy();
    window.dispatchEvent(new Event("beforeprint"));
    expect(printed).toHaveLength(2);
    const removed = vi.spyOn(window, "removeEventListener");
    await reveal.init();
    reveal.destroy();
    expect(removed.mock.calls.map(([type]) => type)).toEqual(["beforeprint", "afterprint"]);
    removed.mockRestore();
  });
});

describe("destroy() and what types left behind", () => {
  // A stand-in type that sets a from-state inline, as the built-in ones do.
  async function setup() {
    const { createRevealCore, registry } = await loadCore();
    const reveal = createRevealCore(() => (target) => {
      target.style.opacity = "0";
      target.style.transform = "translateY(20px)";
      registry.add(target, { kill: () => {} });
    });
    html(`<section id="swap"><div id="a" data-reveal="fade" style="color: red;"></div></section>`);
    await reveal.init();
    return reveal;
  }

  it("puts elements back as they were before init() by default", async () => {
    const reveal = await setup();
    reveal.destroy();
    expect(el("a").style.cssText).toBe("color: red;");
    // Still marked as handled, so reveal.css doesn't hide it again.
    expect(state("a")).toBe("ready");
  });

  it("keeps inline styles the site set since init()", async () => {
    const reveal = await setup();
    el("a").style.display = "none";
    el("a").style.outline = "2px solid red";

    reveal.destroy();
    expect(el("a").style.display).toBe("none");
    expect(el("a").style.outlineStyle).toBe("solid");
    expect(el("a").style.opacity).toBe("");
    expect(el("a").style.transform).toBe("");
  });

  it("does the same for a container", async () => {
    const reveal = await setup();
    reveal.destroy(el("swap"));
    expect(el("a").style.cssText).toBe("color: red;");
  });

  it("leaves the inline styles with { revert: false }", async () => {
    const reveal = await setup();
    reveal.destroy({ revert: false });
    expect(el("a").style.opacity).toBe("0");
    expect(el("a").style.transform).toBe("translateY(20px)");
  });

  it("takes the options after a container, or after undefined", async () => {
    const reveal = await setup();
    reveal.destroy(el("swap"), { revert: false });
    expect(el("a").style.opacity).toBe("0");

    await reveal.init();
    reveal.destroy(undefined, { revert: false });
    expect(el("a").style.opacity).toBe("0");
  });

  it("takes a node from another realm, such as an iframe's, as the container", async () => {
    const reveal = await setup();
    // A node from an iframe isn't `instanceof Node` in this realm.
    Object.defineProperty(Node, Symbol.hasInstance, { value: () => false, configurable: true });
    try {
      reveal.destroy(el("swap"), { revert: false });
    } finally {
      delete (Node as unknown as Record<symbol, unknown>)[Symbol.hasInstance];
    }
    expect(el("a").style.opacity).toBe("0");
  });

  it("throws on a first argument that is neither a node nor options, and tears nothing down", async () => {
    const reveal = await setup();
    // Like a jQuery object wrapping the container.
    const wrapped: unknown = Object.assign(Object.create({ jquery: "3.7.1" }), { 0: el("swap"), length: 1 });
    expect(() => reveal.destroy(wrapped as ParentNode)).toThrow(TypeError);
    expect(el("a").style.opacity).toBe("0");

    // null is taken as no container.
    reveal.destroy(null as unknown as undefined, { revert: false });
    expect(el("a").style.opacity).toBe("0");
  });

  it("shows a reverted element that a site's own pre-hide would hide", async () => {
    document.head.innerHTML = `<style>[data-reveal] { opacity: 0; }</style>`;
    const reveal = await setup();
    reveal.destroy(el("swap"));
    expect(el("a").style.opacity).toBe("1");
  });
});

describe("refresh", () => {
  it("is scheduled only once an element became ready", async () => {
    const { createRevealCore, registry } = await loadCore();
    const fade = fakeType(registry);
    const reveal = createRevealCore((type) => (type === "fade" ? fade.init : null));
    html(`<div id="skipped" data-reveal="nope"></div>`);

    await reveal.init();
    // A refresh would import ScrollTrigger first. Once this import is back,
    // one the core had started would be too.
    await import("gsap/ScrollTrigger");
    await settle();
    expect(frames).toHaveLength(0);

    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="a" data-reveal="fade"></div><div id="b" data-reveal="fade"></div>`,
    );
    await reveal.init();
    reveal.refresh();
    await vi.waitFor(() => expect(frames).toHaveLength(1));
    runFrames();
    // Coalesced into one call per frame, in safe mode.
    expect(scrollTrigger.refresh).toHaveBeenCalledTimes(1);
    expect(scrollTrigger.refresh).toHaveBeenCalledWith(true);
  });

  it("resolves once the refresh has run, with one promise for every call before it", async () => {
    const { createRevealCore } = await loadCore();
    const reveal = createRevealCore(() => null);
    const first = reveal.refresh();
    expect(reveal.refresh()).toBe(first);
    let resolved = false;
    void first.then(() => (resolved = true));

    await vi.waitFor(() => expect(frames).toHaveLength(1));
    runFrames();
    expect(scrollTrigger.refresh).toHaveBeenCalledTimes(1);
    await settle();
    expect(resolved).toBe(false);

    refreshed();
    await first;
    expect(scrollTrigger.listeners.size).toBe(0);
    // A call after that frame starts the next refresh.
    expect(reveal.refresh()).not.toBe(first);
  });

  it("doesn't refresh while there are no triggers, and resolves anyway", async () => {
    const { createRevealCore } = await loadCore();
    const reveal = createRevealCore(() => null);
    scrollTrigger.triggers = 0;

    const done = reveal.refresh();
    await vi.waitFor(() => expect(frames).toHaveLength(1));
    runFrames();
    await done;
    expect(scrollTrigger.refresh).not.toHaveBeenCalled();
  });

  it("survives ScrollTrigger failing to load, and works once it can", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      scrollTrigger.fail = true;
      const { createRevealCore, registry } = await loadCore();
      const fade = fakeType(registry);
      const reveal = createRevealCore(() => fade.init);
      html(`<div id="a" data-reveal="fade"></div>`);

      await reveal.init();
      await expect(import("gsap/ScrollTrigger")).rejects.toThrow();
      await settle();
      expect(unhandled).not.toHaveBeenCalled();
      expect(frames).toHaveLength(0);

      // refresh() still resolves, with nothing to refresh.
      await reveal.refresh();

      scrollTrigger.fail = false;
      const done = reveal.refresh();
      await vi.waitFor(() => expect(frames).toHaveLength(1));
      runFrames();
      expect(scrollTrigger.refresh).toHaveBeenCalledTimes(1);
      refreshed();
      await done;
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });
});
