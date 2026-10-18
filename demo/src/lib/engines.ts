import type { CreateRevealOptions, RevealInstance } from "@boccdotdev/data-reveal";

export type EngineId = "gsap" | "motion" | "vanilla";

/** What an engine's entry exports, as far as a type page needs it. */
export interface EngineEntry {
  createReveal: (options?: CreateRevealOptions) => RevealInstance;
}

export interface Engine {
  id: EngineId;
  label: string;
  /** Whether the package has this engine yet. Only available engines can be picked. */
  available: boolean;
  /** Shown next to an engine that isn't available yet. */
  note?: string;
  /** The package entry the engine lives in. */
  entry: string;
  /**
   * Loads that entry. Each engine has an import of its own, so a page only
   * downloads its own engine's chunks: a page on vanilla never loads GSAP.
   */
  load?: () => Promise<EngineEntry>;
  /** Which form of an ease `data-reveal-ease` takes on this engine. */
  ease: "gsap" | "css";
  /** The packages a site installs next to data-reveal for this engine. */
  peers: string[];
  /** For the tests: counts what the engine has running, to check nothing leaks. */
  inspect?: () => Promise<{ triggers: () => number }>;
}

// To turn an engine on once the package ships it: set `load` to an import of
// its entry and `available` to true. The pages need nothing else.
// RFC #51 makes vanilla the default entry in 1.0, and moves GSAP to /gsap.
export const engines: Engine[] = [
  {
    id: "gsap",
    label: "GSAP",
    available: true,
    entry: "@boccdotdev/data-reveal",
    load: () => import("@boccdotdev/data-reveal"),
    ease: "gsap",
    peers: ["gsap"],
    inspect: async () => {
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      return { triggers: () => ScrollTrigger.getAll().length };
    },
  },
  {
    id: "motion",
    label: "Motion",
    available: false,
    note: "Coming later",
    entry: "@boccdotdev/data-reveal/motion",
    ease: "css",
    peers: ["motion"],
  },
  {
    id: "vanilla",
    label: "Vanilla",
    available: false,
    note: "Coming in 1.0",
    entry: "@boccdotdev/data-reveal",
    ease: "css",
    peers: [],
  },
];

export const defaultEngine = engines.find((engine) => engine.available) as Engine;

/** The engine with this id if it can run, else the default one. */
export function engineFor(id: string | null): Engine {
  return engines.find((engine) => engine.id === id && engine.available) ?? defaultEngine;
}
