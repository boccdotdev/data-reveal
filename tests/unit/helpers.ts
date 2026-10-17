import { vi } from "vitest";
import type { RevealInit } from "../../src/internal/types";

// The core and the registry both keep module-level state (the refresh queue,
// the registry singleton), so each test loads fresh copies.
export async function loadCore() {
  vi.resetModules();
  const { createRevealCore } = await import("../../src/core/createRevealCore");
  const { registry } = await import("../../src/core/registry");
  return { createRevealCore, registry };
}

type Registry = Awaited<ReturnType<typeof loadCore>>["registry"];

// A stand-in for a built-in type: it records each element it arms and
// registers a killable for it, as a real type registers its tween.
export function fakeType(registry: Registry) {
  const armed: Element[] = [];
  const kills = new Map<Element, ReturnType<typeof vi.fn>>();
  const init: RevealInit = (el) => {
    armed.push(el);
    const kill = vi.fn();
    kills.set(el, kill);
    registry.add(el, { kill });
  };
  return { init, armed, kills };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function html(markup: string): void {
  document.body.innerHTML = markup;
}

export function el(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`#${id} not found`);
  return found;
}

export function state(id: string): string | null {
  return el(id).getAttribute("data-reveal-state");
}

// Lets pending promise callbacks and timers run.
export function settle(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
