import { engineFor, type Engine } from "./engines";

// The engine is one choice for the whole site. It travels between pages in
// `?engine=` on the nav links, and this browser remembers it too.

const storageKey = "data-reveal-demo:engine";

function stored(): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

/** The engine this page runs: the URL's if it names one that can run, else the remembered one, else the default. */
export function chosenEngine(): Engine {
  const fromUrl = new URLSearchParams(location.search).get("engine");
  const engine = engineFor(fromUrl ?? stored());
  if (fromUrl !== null && engine.id === fromUrl) remember(engine);
  return engine;
}

function remember(engine: Engine): void {
  try {
    localStorage.setItem(storageKey, engine.id);
  } catch {
    // Without storage, the nav links still carry the choice.
  }
}

/** Points the nav links at the engine, so the next page runs it too. */
export function linkEngine(engine: Engine): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>("a[data-nav]")) {
    const url = new URL(link.href);
    url.searchParams.set("engine", engine.id);
    link.href = url.href;
  }
}

/** Switches the whole site to an engine. */
export function chooseEngine(engine: Engine): void {
  remember(engine);
  linkEngine(engine);
}
