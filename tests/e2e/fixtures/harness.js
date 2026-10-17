// Runs data-reveal on a fixture page and reports back on window.__reveal:
// `instance` once the package has loaded, then `settled` and `result` once
// init() has finished.
//
// Query parameters, on top of the ones head.js reads:
//   mode=manual   use the manual entry instead of the auto one
//   types=a,b     the types to register in manual mode (default: all)
//   init=0        load the package but don't call init()
const params = new URLSearchParams(location.search);
const engine = params.get("engine") ?? "gsap";

const allTypes = ["fade", "scale", "split", "batch", "blur", "clip", "rotate", "slide", "counter", "parallax"];

// Where each engine's entry points live.
const entries = {
  gsap: {
    auto: "../dist/index.js",
    manual: "../dist/manual.js",
    type: (name) => `../dist/types/${name}.js`,
  },
};

const report = (window.__reveal = { instance: null, settled: false, result: null });

async function create() {
  const entry = entries[engine];
  if (!entry) throw new Error(`Unknown engine "${engine}"`);
  if (params.get("mode") === "manual") {
    const names = params.has("types") ? params.get("types").split(",").filter(Boolean) : allTypes;
    const { createReveal } = await import(entry.manual);
    const types = await Promise.all(names.map(async (name) => (await import(entry.type(name)))[name]));
    return createReveal({ types });
  }
  const { createReveal } = await import(entry.auto);
  return createReveal();
}

report.instance = await create();
if (params.get("init") !== "0") {
  try {
    await report.instance.init();
    report.result = "resolved";
  } catch (error) {
    report.result = `rejected: ${error instanceof Error ? error.message : error}`;
  }
  report.settled = true;
}
