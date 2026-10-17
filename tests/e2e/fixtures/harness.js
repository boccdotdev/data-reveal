// Runs data-reveal on a fixture page and reports back on window.__reveal:
// `instance` once the package has loaded (and `second`, with `second=`),
// then `settled` and `result` once init() has finished, and `refreshes`, a
// count of finished position refreshes. If the package fails to load,
// `result` starts with "failed to load" and `settled` is set straight away.
//
// Query parameters, on top of the ones head.js reads:
//   mode=manual   use the manual entry instead of the auto one
//   types=a,b     the types to register in manual mode (default: all)
//   init=0        load the package but don't call init()
//   options=JSON  `defaults` and `typeDefaults` for createReveal()
//   scroller=CSS  scroll inside this element instead of the window
//   second=a,b    also create a manual-mode instance for these types, as a
//                 separate script would, and init() it after the first
//   copy=1        load that second instance from a second copy of the
//                 package, as a separately bundled script would
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
    // The same files at another URL, so the browser loads them as a module
    // graph of their own, with its own registry.
    copy: (url) => url.replace("../dist/", "../dist-copy/"),
    async useScroller(selector) {
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      ScrollTrigger.defaults({ scroller: selector });
    },
    async onRefresh(callback) {
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      ScrollTrigger.addEventListener("refresh", callback);
    },
  },
};

const report = (window.__reveal = { instance: null, second: null, settled: false, result: null, refreshes: 0 });

const typeNames = (list) => list.split(",").filter(Boolean);

async function createManual(entry, names, at = (url) => url) {
  const { createReveal } = await import(at(entry.manual));
  const types = await Promise.all(names.map(async (name) => (await import(at(entry.type(name))))[name]));
  return createReveal({ ...options, types });
}

async function create() {
  const entry = entries[engine];
  if (!entry) throw new Error(`Unknown engine "${engine}"`);
  if (params.has("scroller")) await entry.useScroller(params.get("scroller"));
  await entry.onRefresh(() => report.refreshes++);
  if (params.has("second")) {
    const at = params.get("copy") === "1" ? entry.copy : undefined;
    report.second = await createManual(entry, typeNames(params.get("second")), at);
  }
  if (params.get("mode") === "manual") {
    return createManual(entry, params.has("types") ? typeNames(params.get("types")) : allTypes);
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
    await report.second?.init();
    report.result = "resolved";
  } catch (error) {
    report.result = `rejected: ${error instanceof Error ? error.message : error}`;
  }
  report.settled = true;
}
