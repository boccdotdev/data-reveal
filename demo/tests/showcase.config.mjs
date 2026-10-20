// The site built with two made-up showcase entries, for the tests: the real
// list ships empty. Served at /showcase-fixture/ by tests/server.mjs.
import { fileURLToPath } from "node:url";
import config from "../astro.config.mjs";

const fixture = fileURLToPath(new URL("./fixtures/showcase.ts", import.meta.url));

export default {
  ...config,
  base: "/showcase-fixture/",
  outDir: "./tests/.showcase-dist",
  vite: {
    ...config.vite,
    resolve: {
      ...config.vite?.resolve,
      alias: [{ find: /^(\.\.\/)+data\/showcase$/, replacement: fixture }],
    },
  },
};
