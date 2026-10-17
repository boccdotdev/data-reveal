// Runs data-reveal on a fixture page and reports back on window.__reveal:
// `instance` once the package has loaded, then `settled` and `result` once
// init() has finished. If the package fails to load, `result` starts with
// "failed to load" and `settled` is set straight away.
//
// Query parameters, on top of the ones head.js reads:
//   mode=manual   use the manual entry instead of the auto one
//   types=a,b     the types to register in manual mode (default: all)
//   init=0        load the package but don't call init()
//   options=JSON  `defaults` and `typeDefaults` for createReveal()
//   scroller=CSS  scroll inside this element instead of the window
const params = new URLSearchParams(location.search);
const engine = params.get("engine") ?? "gsap";

const options = params.has("options") ? JSON.parse(params.get("options")) : {};

const allTypes = ["fade", "scale", "split", "batch", "blur", "clip", "rotate", "slide", "counter", "parallax"];

// Where each engine's entry points live.
const entries = {
  gsap: {
    auto: "../dist/index.js",
    manual: "../dist/manual.js",
    type: (name) => `../dist/types/${name}.js`,
    async useScroller(selector) {
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      ScrollTrigger.defaults({ scroller: selector });
    },
  },
};

const report = (window.__reveal = { instance: null, settled: false, result: null });

async function create() {
  const entry = entries[engine];
  if (!entry) throw new Error(`Unknown engine "${engine}"`);
  if (params.has("scroller")) await entry.useScroller(params.get("scroller"));
  if (params.get("mode") === "manual") {
    const names = params.has("types") ? params.get("types").split(",").filter(Boolean) : allTypes;
    const { createReveal } = await import(entry.manual);
    const types = await Promise.all(names.map(async (name) => (await import(entry.type(name)))[name]));
    return createReveal({ ...options, types });
  }
  const { createReveal } = await import(entry.auto);
  return createReveal(options);
}

try {
  report.instance = await create();
} catch (error) {
  // Settle now, so tests fail on the reason instead of timing out.
  report.result = `failed to load: ${error instanceof Error ? error.message : error}`;
  report.settled = true;
}
if (report.instance && params.get("init") !== "0") {
  try {
    await report.instance.init();
    report.result = "resolved";
  } catch (error) {
    report.result = `rejected: ${error instanceof Error ? error.message : error}`;
  }
  report.settled = true;
}
