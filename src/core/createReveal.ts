import { createRevealCore } from "./createRevealCore.js";
import type { RevealInstance } from "./createRevealCore.js";
import type { RevealType, RevealInit } from "../internal/types.js";

// Each entry is a separate dynamic import. Bundlers turn these into individual
// chunks, so a type's code (and its GSAP plugin) is only fetched when an
// element using that type is actually present on the page.
//
// Referencing all loaders here is what forces every type chunk to be emitted
// into the consumer's build. Size-sensitive consumers should instead import
// `@boccdotdev/data-reveal/manual` and register only the types they use — that
// entry has no reference to this record, so unused type files are never built.
const loaders: Record<RevealType, () => Promise<{ init: RevealInit }>> = {
  fade: () => import("../types/fade.js"),
  scale: () => import("../types/scale.js"),
  split: () => import("../types/split.js"),
  batch: () => import("../types/batch.js"),
  blur: () => import("../types/blur.js"),
  clip: () => import("../types/clip.js"),
  rotate: () => import("../types/rotate.js"),
  slide: () => import("../types/slide.js"),
  counter: () => import("../types/counter.js"),
  parallax: () => import("../types/parallax.js"),
};

/**
 * Auto mode: zero config. `init()` scans the DOM and lazily imports whichever
 * type modules are present. Convenient, but every type chunk ships in the
 * build. For minimal builds, use `@boccdotdev/data-reveal/manual`.
 */
export function createReveal(): RevealInstance {
  return createRevealCore(async (type) => {
    const loader = loaders[type as RevealType];
    if (!loader) return null;
    return (await loader()).init;
  });
}
