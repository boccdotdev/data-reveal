import { defineConfig } from "tsup";

export default defineConfig({
  // index = auto entry; manual = loaders-free registration entry; each type is
  // its own entry so it has a stable filename for subpath imports
  // (`@boccdotdev/data-reveal/fade`). Shared code (core, registry, trigger) is
  // split into chunks the entries share, keeping the registry a single instance.
  entry: [
    "src/index.ts",
    "src/manual.ts",
    "src/types/batch.ts",
    "src/types/blur.ts",
    "src/types/clip.ts",
    "src/types/counter.ts",
    "src/types/fade.ts",
    "src/types/parallax.ts",
    "src/types/rotate.ts",
    "src/types/scale.ts",
    "src/types/slide.ts",
    "src/types/split.ts",
  ],
  format: ["esm"],
  dts: true,
  splitting: true,
  clean: true,
  treeshake: true,
  target: "es2020",
  outDir: "dist",
  // Keep gsap (and its plugin subpaths) out of the bundle so the consumer's
  // single gsap instance is used. Plugins register onto that one instance.
  external: ["gsap", "gsap/ScrollTrigger", "gsap/SplitText"],
});
