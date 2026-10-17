import { beforeEach, describe, expect, it, vi } from "vitest";
import { el, html, loadCore } from "./helpers";

beforeEach(() => {
  document.body.innerHTML = "";
});

async function setup() {
  const { registry } = await loadCore();
  html(`
    <section id="outer">
      <div id="inner"><p id="deep"></p></div>
    </section>
    <div id="other"></div>
  `);
  const kills = new Map<string, ReturnType<typeof vi.fn>>();
  for (const id of ["outer", "inner", "deep", "other"]) {
    const kill = vi.fn();
    kills.set(id, kill);
    registry.add(el(id), { kill });
  }
  return { registry, kills };
}

describe("registry", () => {
  it("track() registers a tween and its ScrollTrigger", async () => {
    const { registry } = await loadCore();
    html(`<div id="a"></div>`);
    const tween = { kill: vi.fn(), scrollTrigger: { kill: vi.fn() } };

    registry.track(el("a"), tween);
    registry.killAll();
    expect(tween.kill).toHaveBeenCalledTimes(1);
    expect(tween.scrollTrigger.kill).toHaveBeenCalledTimes(1);
  });

  it("kill(container) kills the container and everything inside it", async () => {
    const { registry, kills } = await setup();

    registry.kill(el("outer"));
    expect(kills.get("outer")).toHaveBeenCalledTimes(1);
    expect(kills.get("inner")).toHaveBeenCalledTimes(1);
    expect(kills.get("deep")).toHaveBeenCalledTimes(1);
    expect(kills.get("other")).not.toHaveBeenCalled();

    // Killed entries are dropped, so they aren't killed twice.
    registry.killAll();
    expect(kills.get("outer")).toHaveBeenCalledTimes(1);
    expect(kills.get("other")).toHaveBeenCalledTimes(1);
  });

  it("kill(container) works on a subtree that has left the page", async () => {
    const { registry, kills } = await setup();
    const outer = el("outer");

    outer.remove();
    registry.kill(outer);
    expect(kills.get("deep")).toHaveBeenCalledTimes(1);
  });

  it("killElement(el) kills only that element's entries", async () => {
    const { registry, kills } = await setup();

    registry.killElement(el("outer"));
    expect(kills.get("outer")).toHaveBeenCalledTimes(1);
    expect(kills.get("inner")).not.toHaveBeenCalled();
    expect(kills.get("deep")).not.toHaveBeenCalled();

    registry.killAll();
    expect(kills.get("outer")).toHaveBeenCalledTimes(1);
    expect(kills.get("inner")).toHaveBeenCalledTimes(1);
  });

  it("killAll() and kill(container) kill only the reveals `owned` accepts", async () => {
    const { registry, kills } = await setup();
    const mine = (element: Element) => element.id !== "inner";

    expect(registry.kill(el("outer"), { owned: mine })).toEqual([el("outer"), el("deep")]);
    expect(kills.get("inner")).not.toHaveBeenCalled();
    expect(registry.killAll({ owned: mine })).toEqual([el("other")]);
    expect(kills.get("inner")).not.toHaveBeenCalled();
    expect(registry.size).toBe(1);
  });

  it("reverts splits when their element is killed", async () => {
    const { registry } = await loadCore();
    html(`<h2 id="a"></h2>`);
    const split = { revert: vi.fn() };

    registry.addRevert(el("a"), split);
    registry.killElement(el("a"));
    expect(split.revert).toHaveBeenCalledTimes(1);
  });
});

describe("snapshots", () => {
  it('"animated" puts back the animated props and the text, and keeps other inline styles', async () => {
    const { registry } = await loadCore();
    html(`<div id="a" style="color: red;">0</div>`);
    registry.snapshot(el("a"), el("a"), { text: "1,200" });
    el("a").style.opacity = "0";
    el("a").style.transform = "translateY(20px)";
    // Set by the site after init().
    el("a").style.display = "none";

    registry.killAll({ restore: "animated" });
    expect(el("a").style.cssText).toBe("color: red; display: none;");
    expect(el("a").textContent).toBe("1,200");
  });

  it('"style" puts back the whole style attribute, or removes one the element didn\'t have', async () => {
    const { registry } = await loadCore();
    html(`<div id="a" style="color: red;"></div><div id="b"></div>`);
    registry.snapshot(el("a"), el("a"));
    registry.snapshot(el("b"), el("b"));
    el("a").style.display = "none";
    el("b").style.transform = "translateY(20px)";

    registry.killElement(el("a"), { restore: "style" });
    registry.killElement(el("b"), { restore: "style" });
    expect(el("a").style.cssText).toBe("color: red;");
    expect(el("b").hasAttribute("style")).toBe(false);
  });

  it("puts back other elements a type snapshotted, such as batch items", async () => {
    const { registry } = await loadCore();
    html(`<ul id="list"><li id="item"></li></ul><div id="other"></div>`);
    registry.snapshot(el("list"), el("item"));
    registry.snapshot(el("other"), el("other"));
    el("item").style.opacity = "0";
    el("other").style.opacity = "0";

    expect(registry.kill(el("list"), { restore: "animated" })).toEqual([el("list")]);
    expect(el("item").hasAttribute("style")).toBe(false);
    expect(el("other").style.opacity).toBe("0");
  });

  it("leaves everything as it is without restore", async () => {
    const { registry } = await loadCore();
    html(`<div id="a">12</div>`);
    registry.snapshot(el("a"), el("a"), { text: "12" });
    el("a").style.opacity = "0";
    el("a").textContent = "0";

    registry.killAll();
    expect(el("a").style.opacity).toBe("0");
    expect(el("a").textContent).toBe("0");
  });

  it("keeps the first snapshot of an element", async () => {
    const { registry } = await loadCore();
    html(`<div id="a"></div>`);
    registry.snapshot(el("a"), el("a"));
    el("a").style.opacity = "0";
    registry.snapshot(el("a"), el("a"));

    registry.killAll({ restore: "animated" });
    expect(el("a").hasAttribute("style")).toBe(false);
  });

  it("shares one snapshot between two reveals on an element", async () => {
    const { registry } = await loadCore();
    html(`<ul id="list"><li id="item"></li></ul>`);
    // batch arms first and hides its item, then the item's own fade arms.
    registry.snapshot(el("list"), el("item"));
    el("item").style.transform = "translate(0px, 20px)";
    registry.snapshot(el("item"), el("item"));

    // The second reveal didn't record the first one's starting state.
    registry.restoreAnimated(el("item"));
    expect(el("item").hasAttribute("style")).toBe(false);
  });

  it("puts a shared snapshot back when no reveal is still animating the target", async () => {
    const { registry } = await loadCore();
    html(`<ul id="list"><li id="item"></li></ul>`);
    registry.snapshot(el("list"), el("item"));
    registry.snapshot(el("item"), el("item"));
    // The item's own reveal is stopped partway; the batch has finished.
    registry.started(el("item"), el("item"));
    registry.finished(el("list"));
    el("item").style.opacity = "0.1";

    registry.killElement(el("item"), { restore: "animated" });
    expect(el("item").hasAttribute("style")).toBe(false);
  });

  it("leaves a shared target to a reveal still to play there, such as another instance's", async () => {
    const { registry } = await loadCore();
    html(`<ul id="list"><li id="item"></li></ul>`);
    registry.snapshot(el("list"), el("item"));
    registry.snapshot(el("item"), el("item"));
    // The item's own fade is waiting below the fold, hiding it.
    el("item").style.opacity = "0";
    const reset = vi.fn();
    registry.resetOnRestore(el("item"), reset);

    registry.killElement(el("list"), { restore: "animated" });
    expect(el("item").style.opacity).toBe("0");
    expect(reset).not.toHaveBeenCalled();
    // Once that reveal is killed too, the item goes back.
    registry.killElement(el("item"), { restore: "animated" });
    expect(el("item").hasAttribute("style")).toBe(false);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("finishes a reveal that yielded a target once the reveal it yielded to is done with it", async () => {
    const { registry } = await loadCore();
    html(`<ul id="list"><li id="item"></li></ul>`);
    registry.snapshot(el("list"), el("item"));
    registry.snapshot(el("item"), el("item"));
    registry.started(el("list"), el("item"));
    expect(registry.animatedByOthers(el("item"), el("item"))).toBe(true);
    expect(registry.animatedByOthers(el("list"), el("item"))).toBe(false);
    const done = vi.fn();
    registry.yieldTo(el("item"), el("item"), done);

    registry.stopped(el("list"), el("item"));
    registry.settle(el("item"));
    expect(done).toHaveBeenCalledTimes(1);
    // Killed instead, the reveal it yielded to still finishes it, and its own
    // waiting doesn't hold the restore back.
    registry.started(el("list"), el("item"));
    registry.yieldTo(el("item"), el("item"), done);
    el("item").style.opacity = "0.4";
    registry.killElement(el("list"), { restore: "animated" });
    expect(done).toHaveBeenCalledTimes(2);
    expect(el("item").hasAttribute("style")).toBe(false);
  });

  it("leaves a target that another reveal is still animating, to hand it back itself", async () => {
    const { registry } = await loadCore();
    html(`<ul id="list"><li id="item"></li></ul>`);
    registry.snapshot(el("list"), el("item"));
    registry.snapshot(el("item"), el("item"));
    registry.started(el("list"), el("item"));
    el("item").style.opacity = "0.1";

    registry.killElement(el("item"), { restore: "animated" });
    expect(el("item").style.opacity).toBe("0.1");
    expect(registry.animating(el("item"))).toBe(true);
    registry.stopped(el("list"), el("item"));
    expect(registry.animating(el("item"))).toBe(false);
  });

  it("knows an element a reveal styled before, or one another reveal shares", async () => {
    const { registry } = await loadCore();
    html(`<ul id="list"><li id="item"></li></ul>`);
    registry.snapshot(el("item"), el("item"));
    expect(registry.styledBefore(el("item"))).toEqual({ rerun: false, shared: false });
    registry.snapshot(el("list"), el("item"));
    expect(registry.styledBefore(el("item"))).toEqual({ rerun: false, shared: true });

    registry.killAll({ restore: "animated" });
    registry.snapshot(el("item"), el("item"));
    expect(registry.styledBefore(el("item"))).toEqual({ rerun: true, shared: false });
  });

  it("puts back the transform attributes GSAP sets on SVG elements", async () => {
    const { registry } = await loadCore();
    document.body.innerHTML = `<svg><rect id="rect"></rect></svg>`;
    const rect = document.getElementById("rect") as unknown as HTMLElement;
    registry.snapshot(rect, rect);
    rect.setAttribute("transform", "matrix(0.5,0.5,-0.5,0.5,10,10)");
    rect.setAttribute("data-svg-origin", "50 30");

    registry.killAll({ restore: "animated" });
    expect(rect.hasAttribute("transform")).toBe(false);
    expect(rect.hasAttribute("data-svg-origin")).toBe(false);
  });

  it("restoreAnimated hands back only the animated props", async () => {
    const { registry } = await loadCore();
    html(`<div id="a" style="color: red; opacity: 0.5;"></div>`);
    registry.snapshot(el("a"), el("a"));
    const style = el("a").style;
    style.opacity = "1";
    style.transform = "translate(0px, 0px)";
    style.clipPath = "inset(0px)";
    style.filter = "blur(0px)";
    // A change of the site's own while the reveal ran.
    style.color = "blue";

    registry.restoreAnimated(el("a"));
    expect(style.opacity).toBe("0.5");
    expect(style.transform).toBe("");
    expect(style.clipPath).toBe("");
    expect(style.filter).toBe("");
    expect(style.color).toBe("blue");
  });
});

describe("release()", () => {
  it("drops a finished reveal, killing what it registered", async () => {
    const { registry } = await loadCore();
    html(`<div id="a"></div><div id="b"></div>`);
    const tween = { kill: vi.fn(), scrollTrigger: { kill: vi.fn() } };
    registry.snapshot(el("a"), el("a"));
    registry.track(el("a"), tween);
    registry.snapshot(el("b"), el("b"));

    registry.release(el("a"));
    expect(registry.size).toBe(1);
    expect(tween.kill).toHaveBeenCalledTimes(1);
    expect(tween.scrollTrigger.kill).toHaveBeenCalledTimes(1);
    // destroy() has nothing left to do for it.
    el("a").style.opacity = "0.5";
    expect(registry.killAll({ restore: "animated" })).toEqual([el("b")]);
    expect(el("a").style.opacity).toBe("0.5");
  });

  it("waits for every reveal sharing a snapshot to finish, then drops them together", async () => {
    const { registry } = await loadCore();
    html(`<ul id="list"><li id="item"></li></ul>`);
    registry.snapshot(el("list"), el("list"));
    registry.snapshot(el("list"), el("item"));
    registry.snapshot(el("item"), el("item"));

    registry.release(el("item"));
    expect(registry.size).toBe(2);
    registry.release(el("list"));
    expect(registry.size).toBe(0);
  });

  it("lets a later reveal of the same target take a fresh snapshot", async () => {
    const { registry } = await loadCore();
    html(`<div id="a"></div>`);
    registry.snapshot(el("a"), el("a"));
    registry.release(el("a"));

    el("a").style.color = "red";
    registry.snapshot(el("a"), el("a"));
    el("a").style.opacity = "0";
    registry.killAll({ restore: "style" });
    expect(el("a").style.cssText).toBe("color: red;");
  });
});
