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
