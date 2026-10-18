// On every page: the nav and settings panels (a rail and a hideable column
// on wide screens, drawers on narrow ones), the engine on the nav links,
// and the Copy buttons on code blocks.
//
// The ClientRouter runs this once and keeps the document, so the listeners
// here are on the document and serve every page. What depends on the page
// in view is redone on `astro:page-load`.
import { chosenEngine, linkEngine } from "../lib/engine-choice";

const root = document.documentElement;
const wide = window.matchMedia("(width >= 60rem)");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

// On a wide screen the nav folds to a rail of icons and the settings hide.
// Each button says whether its panel is open in full, and the browser
// remembers both.
type Panel = "nav" | "settings";
const panels: Record<Panel, { attribute: string; key: string; closed: string; open: string }> = {
  nav: { attribute: "data-nav-rail", key: "data-reveal-demo:nav", closed: "rail", open: "full" },
  settings: { attribute: "data-settings-hidden", key: "data-reveal-demo:settings", closed: "hidden", open: "shown" },
};

const closed = (panel: Panel): boolean => root.hasAttribute(panels[panel].attribute);

// A hidden settings pane on a wide screen is out of the tab order and the
// accessibility tree too. The rail stays usable. On a narrow screen the
// drawers decide.
function showPanels(): void {
  for (const panel of Object.keys(panels) as Panel[]) {
    for (const toggle of document.querySelectorAll(`[data-panel-toggle="${panel}"]`)) {
      toggle.setAttribute("aria-expanded", String(!closed(panel)));
    }
  }
  document.querySelector("[data-settings-pane]")?.toggleAttribute("inert", wide.matches && closed("settings"));
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Without storage the choice lasts until the page closes.
  }
}

// Once the column has its new width, the page's reveals measure again.
function afterLayout(target: Element | null): void {
  const done = (): void => {
    document.dispatchEvent(new CustomEvent("demo:layout"));
  };
  if (reduced.matches || !target) {
    requestAnimationFrame(done);
    return;
  }
  // The grid's own column transition, not one bubbling up from inside it.
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    target.removeEventListener("transitionend", ended);
    done();
  };
  const ended = (event: Event): void => {
    if (event.target === target && (event as TransitionEvent).propertyName === "grid-template-columns") finish();
  };
  target.addEventListener("transitionend", ended);
  window.setTimeout(finish, 400);
}

function togglePanel(panel: Panel): void {
  const close = !closed(panel);
  root.toggleAttribute(panels[panel].attribute, close);
  store(panels[panel].key, close ? panels[panel].closed : panels[panel].open);
  showPanels();
  afterLayout(document.querySelector(".site"));
}

// Narrow screens: the nav menu and the settings drawer, one open at a time.

const control = (selector: string): HTMLElement | null => document.querySelector(selector);

const expanded = (selector: string): boolean => control(selector)?.getAttribute("aria-expanded") === "true";

// While a drawer is open, the page behind it is out of reach (inert), and
// focus starts in the drawer. The bar with the Menu and Settings buttons
// stays usable, so either can close it, and closing puts focus back on the
// button.
function shield(): void {
  const menuOpen = expanded("[data-menu-toggle]");
  const settingsOpen = expanded("[data-settings-drawer]");
  for (const behind of document.querySelectorAll(".column, .skip-link")) behind.toggleAttribute("inert", menuOpen || settingsOpen);
  if (menuOpen) control("[data-settings-pane]")?.setAttribute("inert", "");
  else showPanels();
}

const firstControl = (within: HTMLElement | null): HTMLElement | null | undefined =>
  within?.querySelector<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), select, [tabindex='0']");

function openMenu(open: boolean): void {
  const was = expanded("[data-menu-toggle]");
  control("[data-menu-toggle]")?.setAttribute("aria-expanded", String(open));
  control("[data-menu]")?.toggleAttribute("data-open", open);
  if (open) openSettings(false);
  shield();
  if (open && !was) firstControl(control("[data-menu]"))?.focus();
}

function openSettings(open: boolean): void {
  const was = expanded("[data-settings-drawer]");
  control("[data-settings-drawer]")?.setAttribute("aria-expanded", String(open));
  root.toggleAttribute("data-settings-open", open);
  if (open) openMenu(false);
  shield();
  if (open && !was) firstControl(control("[data-settings-pane]"))?.focus();
}

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const panel = target?.closest<HTMLElement>("[data-panel-toggle]");
  if (panel) togglePanel(panel.dataset.panelToggle as Panel);
  else if (target?.closest("[data-menu-toggle]")) closeOr(openMenu, "[data-menu-toggle]");
  else if (target?.closest("[data-settings-drawer]")) closeOr(openSettings, "[data-settings-drawer]");
});

function closeOr(open: (open: boolean) => void, button: string): void {
  const closing = expanded(button);
  open(!closing);
  if (closing) control(button)?.focus();
}

// Escape closes an open drawer and puts focus back on its button. With no
// drawer open, it hides the rail's tooltip (WCAG 1.4.13) until the pointer
// or focus moves to another item.
const tipped = (target: EventTarget | null): Element | null =>
  target instanceof Element ? target.closest(".nav :is(a, button):has(> .nav-text)") : null;
let tipDismissed: Element | null = null;

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (expanded("[data-menu-toggle]")) {
    openMenu(false);
    control("[data-menu-toggle]")?.focus();
  } else if (expanded("[data-settings-drawer]")) {
    openSettings(false);
    control("[data-settings-drawer]")?.focus();
  } else if (root.hasAttribute("data-nav-rail")) {
    tipDismissed = document.querySelector(".nav :is(a, button):has(> .nav-text):hover") ?? tipped(document.activeElement);
    root.toggleAttribute("data-tips-hidden", tipDismissed !== null);
  }
});

for (const type of ["pointerover", "focusin"]) {
  document.addEventListener(type, (event) => {
    if (root.hasAttribute("data-tips-hidden") && tipped(event.target) !== tipDismissed) {
      root.removeAttribute("data-tips-hidden");
    }
  });
}

wide.addEventListener("change", () => {
  showPanels();
  openMenu(false);
  openSettings(false);
});

// Copies the block's code as plain text, without the highlighting. The
// button says Copied, or Failed, for a moment and then Copy again; another
// click starts the moment over.
const resets = new WeakMap<Element, number>();

document.addEventListener("click", async (event) => {
  const button = event.target instanceof Element ? event.target.closest("[data-copy]") : null;
  const block = button?.closest("[data-code-block]");
  if (!button || !block) return;
  const label = button.querySelector("[data-copy-label]");
  const status = block.querySelector("[data-copy-status]");
  let copied = true;
  try {
    await navigator.clipboard.writeText(block.querySelector("pre")?.textContent ?? "");
  } catch {
    copied = false;
  }
  if (label) label.textContent = copied ? "Copied" : "Failed";
  // Emptied first, so a second copy is announced again.
  if (status) {
    status.textContent = "";
    requestAnimationFrame(() => (status.textContent = copied ? "Copied" : "Couldn't copy. Select the code and copy it instead."));
  }
  if (copied) document.dispatchEvent(new CustomEvent("demo:copied"));
  window.clearTimeout(resets.get(button));
  resets.set(
    button,
    window.setTimeout(() => {
      if (label) label.textContent = "Copy";
      if (status) status.textContent = "";
    }, 1500),
  );
});

// Page changes. The nav is kept, so it marks the new page itself and keeps
// its scroll. The new page's root element starts without the panel states,
// so they're carried over before it shows.

let navScroll = 0;

document.addEventListener("astro:before-swap", (event) => {
  const next = event.newDocument.documentElement;
  for (const { attribute } of Object.values(panels)) next.toggleAttribute(attribute, root.hasAttribute(attribute));
  navScroll = control(".nav-inner")?.scrollTop ?? 0;
});

document.addEventListener("astro:after-swap", () => {
  const inner = control(".nav-inner");
  if (inner) inner.scrollTop = navScroll;
});

function markCurrent(): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>(".nav-links a")) {
    const here = new URL(link.href).pathname === location.pathname;
    if (here) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

function pageLoaded(): void {
  showPanels();
  openMenu(false);
  openSettings(false);
  markCurrent();
  linkEngine(chosenEngine());
}

document.addEventListener("astro:page-load", pageLoaded);
pageLoaded();
