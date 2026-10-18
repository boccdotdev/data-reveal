// A type's page: the example running in the page, its settings, the HTML
// code block and the tabs between example and code. The page URL holds the
// settings, so a link reopens them, and `#code` opens the Code tab. It plays
// no sounds itself: scripts/sound.ts listens to the same controls and to the
// events this dispatches.
//
// The ClientRouter runs this module once, whichever type page comes first,
// so each page is set up on `astro:page-load`. Listeners on the page's own
// elements go with it when the next page swaps in.
import { highlightHtml, runsToHtml } from "../lib/code";
import { cssEasing, curvePath, gsapEase, splitEase, type EaseDirection } from "../lib/eases";
import { chooseEngine } from "../lib/engine-choice";
import { engineFor } from "../lib/engines";
import { attributes, easeValue, htmlSnippet, initialValues, parseValues, settingsQuery, type Values } from "../lib/settings";
import { typeFor } from "../lib/types";
import { engine, logFailure, reveal } from "./reveal";

const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(selector);
const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] =>
  Array.from(root.querySelectorAll<T>(selector));

// Updates the URL without dropping the state the ClientRouter keeps there,
// which back and forward need.
const replaceUrl = (url: string): void => history.replaceState(history.state, "", url);

// A rebuild still waiting when the page changes is dropped, and so is a
// panel held at its top (see showFromTop).
let pending: number | undefined;
let hold: AbortController | undefined;
document.addEventListener("astro:before-swap", () => {
  window.clearTimeout(pending);
  hold?.abort();
});

// A narrower or wider column moves everything, so the reveals measure again.
document.addEventListener("demo:layout", () => void reveal?.refresh());

function mount(): void {
  const page = $("[data-type-page]");
  if (!page || page.hasAttribute("data-mounted")) return;
  page.setAttribute("data-mounted", "");

  const type = typeFor(page.dataset.typePage ?? null);
  const example = $("[data-example]", page) as HTMLElement;
  const slot = $("[data-slot]", example) as HTMLElement;
  const template = $<HTMLTemplateElement>("template[data-demo]", example) as HTMLTemplateElement;
  const settings = $("[data-settings]") as HTMLElement;
  const liveCode = $("[data-live-code]") as HTMLElement;
  const replayButton = $("[data-replay]") as HTMLButtonElement;

  // A link with settings in it opens them. One with only the engine, such
  // as a nav link, starts where the page always does.
  const shared = Array.from(new URLSearchParams(location.search).keys()).some((key) => key !== "engine");
  let values: Values = shared ? parseValues(type, location.search) : initialValues(type);

  // The example. Each build takes the reveal off the old element and arms a
  // fresh copy with the current settings. One already in view plays
  // straight away; one below the fold waits for the page to scroll to it.

  let stale = false;

  async function build(): Promise<void> {
    if (!reveal || !slot.isConnected) return;
    if (example.hidden) {
      stale = true;
      return;
    }
    stale = false;
    reveal.destroy(slot);
    slot.replaceChildren(template.content.cloneNode(true));
    const el = $("[data-reveal]", slot);
    if (!el) return;
    for (const [name, value] of attributes(type, values, engine)) el.setAttribute(name, value ?? "");
    await reveal.init(slot).catch(logFailure);
  }

  function rebuild(wait = 200): void {
    window.clearTimeout(pending);
    pending = window.setTimeout(() => void build(), wait);
  }

  // A panel scrolled past shows from its top, just under the sticky rows.
  function showFromTop(panel: HTMLElement): void {
    const bar = document.querySelector(".tabs-row")?.getBoundingClientRect().bottom ?? 0;
    if (panel.getBoundingClientRect().top < bar - 0.5) panel.scrollIntoView({ block: "start", behavior: "instant" });
  }

  // After a tab swap, the panel is shown from its top and held there for a
  // few seconds, until the reader scrolls. The hold is for ScrollTrigger:
  // a refresh scrolls the page while it measures and then puts it back, and
  // if the page has moved by exactly one scroll event since ScrollTrigger
  // last read it (as here, once the example's reveal has finished), it puts
  // back the position from before the swap. The page then lands where the
  // browser clamps that position, and only that jump is undone.
  function showPanel(panel: HTMLElement, before: number): void {
    showFromTop(panel);
    hold?.abort();
    const current = (hold = new AbortController());
    const listen = { capture: true, passive: true, signal: current.signal };
    for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) {
      window.addEventListener(type, () => current.abort(), listen);
    }
    window.addEventListener(
      "scroll",
      () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (Math.abs(window.scrollY - Math.min(before, max)) < 1) showFromTop(panel);
      },
      listen,
    );
    window.setTimeout(() => current.abort(), 3000);
  }

  // Back to the top of the example, so the element waits below the fold.
  function replay(): void {
    window.clearTimeout(pending);
    showFromTop(example);
    void build();
  }

  replayButton.addEventListener("click", replay);

  // The HTML code block, and the page URL

  function showCode(): void {
    liveCode.innerHTML = runsToHtml(highlightHtml(htmlSnippet(type, values, engine)));
  }

  function remember(): void {
    replaceUrl(`${location.pathname}?${settingsQuery(type, values, engine)}${location.hash}`);
  }

  function changed(): void {
    showCode();
    rebuild();
    remember();
  }

  // Tabs: the example or its code. Arrow keys move between them, as the ARIA
  // tabs pattern has it. Back on the example, it plays again.

  const tabs = $$<HTMLButtonElement>('[role="tab"]');

  function selectTab(name: string, { focus = false, announce = true } = {}): void {
    hold?.abort();
    const before = window.scrollY;
    const index = Math.max(0, tabs.findIndex((tab) => tab.dataset.tab === name));
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute("aria-controls") ?? "");
      if (panel) panel.hidden = !on;
    });
    if (focus) tabs[index].focus();
    const code = tabs[index].dataset.tab === "code";
    if (code) showPanel(document.getElementById("panel-code") as HTMLElement, before);
    replaceUrl(`${location.pathname}${location.search}${code ? "#code" : ""}`);
    if (announce) document.dispatchEvent(new CustomEvent("demo:tab", { detail: { index } }));
    if (!code && (announce || stale)) replay();
  }

  const keys: Record<string, (at: number) => number> = {
    ArrowRight: (at) => (at + 1) % tabs.length,
    ArrowLeft: (at) => (at - 1 + tabs.length) % tabs.length,
    Home: () => 0,
    End: () => tabs.length - 1,
  };

  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      if (tab.getAttribute("aria-selected") !== "true") selectTab(tab.dataset.tab as string);
    });
    tab.addEventListener("keydown", (event) => {
      const move = keys[event.key];
      if (!move) return;
      event.preventDefault();
      const at = tabs.indexOf(tab);
      const to = move(at);
      if (to !== at) selectTab(tabs[to].dataset.tab as string, { focus: true });
    });
  }

  // Ease

  const familyInputs = $$<HTMLInputElement>('input[name="ease-family"]', settings);
  const directionInputs = $$<HTMLInputElement>('input[name="ease-direction"]', settings);
  const checkedValue = (inputs: HTMLInputElement[]): string => inputs.find((input) => input.checked)?.value ?? "";

  // Shows the ease: its family and direction, and each family's curve in that
  // direction.
  function showEase(): void {
    if (type.ease === null) return;
    const parts = values.ease ? splitEase(values.ease) : null;
    const family = parts?.family ?? "builtin";
    const direction = parts?.direction ?? ((checkedValue(directionInputs) || "out") as EaseDirection);
    for (const input of familyInputs) input.checked = input.value === family;
    for (const input of directionInputs) {
      input.checked = input.value === direction;
      input.disabled = family === "builtin" || family === "none";
    }
    for (const path of $$("[data-family-curve]", settings)) {
      path.setAttribute("d", curvePath(cssEasing[gsapEase(path.dataset.familyCurve as string, direction)] ?? "linear"));
    }
    // As this engine's data-reveal-ease takes it.
    ($("[data-ease-name]", settings) as HTMLElement).textContent = values.ease
      ? easeValue(values.ease, engine)
      : `${easeValue(type.ease, engine)} (built-in)`;
  }

  function chooseEase(): void {
    const family = checkedValue(familyInputs);
    values.ease = family === "builtin" ? "" : gsapEase(family, checkedValue(directionInputs) as EaseDirection);
    showEase();
    changed();
  }
  for (const input of [...familyInputs, ...directionInputs]) input.addEventListener("change", chooseEase);

  // The type's own controls

  const show = (key: string, value: string): void => {
    const output = $(`[data-output="${key}"]`, settings);
    const input = $<HTMLInputElement>(`input[type="range"][data-key="${key}"]`, settings);
    const text = `${value}${input?.dataset.unit ?? ""}`;
    if (output) output.textContent = text;
    input?.setAttribute("aria-valuetext", text);
  };

  // Puts every control at the current values.
  function showValues(): void {
    for (const input of $$<HTMLInputElement | HTMLSelectElement>("[data-key]", settings)) {
      const value = values[input.dataset.key as string] ?? "";
      if (input instanceof HTMLInputElement && input.type === "radio") input.checked = input.value === value;
      else if (input instanceof HTMLInputElement && input.type === "checkbox") input.checked = value === "true";
      else input.value = value;
      if (input instanceof HTMLInputElement && input.type === "range") show(input.dataset.key as string, value);
    }
  }

  // Every kind of control fires `input`, radios and switches included.
  settings.addEventListener("input", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement) || !input.dataset.key) return;
    const key = input.dataset.key;
    if (input instanceof HTMLInputElement && input.type === "checkbox") values[key] = String(input.checked);
    else if (input instanceof HTMLInputElement && input.type === "radio" && !input.checked) return;
    else values[key] = input.value;
    if (input instanceof HTMLInputElement && input.type === "range") show(key, input.value);
    changed();
  });

  $("[data-reset]", settings)?.addEventListener("click", () => {
    values = initialValues(type);
    showValues();
    showEase();
    showCode();
    rebuild(0);
    remember();
  });

  // The engine, one choice for the whole site. Each engine gets a document
  // of its own, so switching loads the page in full, outside the router. A
  // control whose option this engine doesn't read is greyed out.

  for (const input of $$<HTMLInputElement>('input[name="engine"]', settings)) input.checked = input.value === engine.id;
  for (const block of $$("[data-engine-code]", page)) block.hidden = block.dataset.engineCode !== engine.id;
  for (const control of type.controls) {
    const off = control.engines !== undefined && !control.engines.includes(engine.id);
    const inputs = $$<HTMLInputElement | HTMLSelectElement>(`[data-key="${control.key}"]`, settings);
    for (const input of inputs) input.disabled = off;
    const note = inputs[0]?.closest(".control")?.querySelector<HTMLElement>("[data-engine-note]");
    if (note) {
      note.hidden = !off;
      note.textContent = off ? `Not on ${engine.label}` : "";
    }
  }

  for (const input of $$<HTMLInputElement>('input[name="engine"]', settings)) {
    input.addEventListener("change", () => {
      const next = engineFor(input.value);
      if (next.id === engine.id) return;
      chooseEngine(next);
      location.replace(`${location.pathname}?${settingsQuery(type, values, next)}${location.hash}`);
    });
  }

  if (shared) {
    showValues();
    showEase();
    showCode();
  }
  // The element as written is already armed, by init() on the first load
  // or after a page change. It needs building again only if these settings
  // add attributes to it.
  if (attributes(type, values, engine).length > 0) void build();
  if (location.hash === "#code") selectTab("code", { announce: false });
  document.documentElement.dataset.exampleState = "ready";
}

document.addEventListener("astro:page-load", mount);
mount();
