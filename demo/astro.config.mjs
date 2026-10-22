// @ts-check
import { defineConfig } from "astro/config";

// The site's address, for canonical links. Set SITE_URL in the build once
// the domain exists. Without it the pages carry no absolute URLs.
const site = process.env.SITE_URL || undefined;

export default defineConfig({
  site,
  vite: {
    resolve: {
      // The package comes from `file:..`, a link to the repo root, which has
      // its own node_modules/gsap. Resolve gsap from here only, so the page
      // has one GSAP and the package's plugins register on it.
      dedupe: ["gsap"],
    },
    server: {
      // `astro dev` serves the package's dist from outside this folder.
      fs: { allow: [".."] },
    },
    optimizeDeps: {
      // The package loads these from outside this folder, where `astro dev`
      // doesn't look for dependencies to prepare up front. Found later, they
      // make the first page that needs one fail to load it.
      include: ["gsap", "gsap/ScrollTrigger", "gsap/SplitText"],
    },
  },
});
