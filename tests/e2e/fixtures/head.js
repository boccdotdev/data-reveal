// Loaded as a classic script at the top of every fixture's <head>, so what it
// writes is parsed before anything else on the page.
//
// Query parameters:
//   engine=gsap        the animation engine (only "gsap" exists so far)
//   css=0              leave out reveal.css
//   failsafe=<value>   set --data-reveal-failsafe
//   prehide=site       add a site's own `[data-reveal] { opacity: 0 }`
(() => {
  const params = new URLSearchParams(location.search);
  const engine = params.get("engine") ?? "gsap";

  // Bare specifiers each engine's modules import. Loaded from node_modules
  // through the server, never from a CDN.
  const importMaps = {
    gsap: {
      gsap: "../gsap/index.js",
      "gsap/ScrollTrigger": "../gsap/ScrollTrigger.js",
      "gsap/SplitText": "../gsap/SplitText.js",
    },
  };
  const imports = importMaps[engine];
  if (!imports) throw new Error(`Unknown engine "${engine}"`);

  document.write(`<script type="importmap">${JSON.stringify({ imports })}<\/script>`);
  if (params.get("css") !== "0") document.write(`<link rel="stylesheet" href="../reveal.css">`);
  const failsafe = params.get("failsafe");
  if (failsafe) document.write(`<style>:root { --data-reveal-failsafe: ${failsafe}; }</style>`);
  if (params.get("prehide") === "site") document.write(`<style>[data-reveal] { opacity: 0; }</style>`);
})();
