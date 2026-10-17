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

  it("reverts splits when their element is killed", async () => {
    const { registry } = await loadCore();
    html(`<h2 id="a"></h2>`);
    const split = { revert: vi.fn() };

    registry.addSplit(el("a"), split);
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

  it("shares one snapshot between two reveals on an element, and puts it back when the last goes", async () => {
    const { registry } = await loadCore();
    html(`<ul id="list"><li id="item"></li></ul>`);
    // batch arms first and hides its item, then the item's own fade arms.
    registry.snapshot(el("list"), el("item"));
    el("item").style.transform = "translate(0px, 20px)";
    registry.snapshot(el("item"), el("item"));

    // The second reveal didn't record the first one's starting state.
    registry.restoreAnimated(el("item"));
    expect(el("item").hasAttribute("style")).toBe(false);

    el("item").style.transform = "translate(0px, 20px)";
    registry.killElement(el("item"), { restore: "animated" });
    expect(el("item").style.transform).toBe("translate(0px, 20px)");
    registry.killElement(el("list"), { restore: "animated" });
    expect(el("item").hasAttribute("style")).toBe(false);
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
