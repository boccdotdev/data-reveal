import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
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
