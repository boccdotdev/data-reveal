import { createRevealCore } from "./core/createRevealCore.js";
import type { RevealInstance } from "./core/createRevealCore.js";
import type { RevealRegistration, RevealInit } from "./internal/types.js";

export interface CreateRevealOptions {
  /**
   * The reveal types to enable, each imported from its own subpath (e.g.
   * `import { fade } from "@boccdotdev/data-reveal/fade"`). Only the types you
   * register here — and their GSAP plugins — are pulled into your build.
   */
  types: RevealRegistration[];
}

/**
 * Manual mode: register only the types you use, so unused type modules are
 * never bundled. This entry has no reference to the auto-loader record, so a
 * build importing it emits exactly the type chunks you import — nothing more.
 *
 * ```ts
 * import { createReveal } from "@boccdotdev/data-reveal/manual";
 * import { fade } from "@boccdotdev/data-reveal/fade";
 * import { scale } from "@boccdotdev/data-reveal/scale";
 *
 * createReveal({ types: [fade, scale] }).init();
 * ```
 */
export function createReveal({ types }: CreateRevealOptions): RevealInstance {
  const map = new Map<string, RevealInit>(types.map((t) => [t.type, t.init]));
  return createRevealCore((type) => map.get(type) ?? null);
}

export type { RevealInstance } from "./core/createRevealCore.js";
export type {
  RevealRegistration,
  RevealType,
  RevealContext,
  RevealInit,
} from "./internal/types.js";
