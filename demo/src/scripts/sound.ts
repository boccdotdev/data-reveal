// Interface sound for the site's controls. The examples stay silent. Every
// cue is chosen here, by listeners on the document that look at what was
// used. No control plays a sound itself.
//
// Foley synthesises its cues with Web Audio, so there are no files to load.
// Browsers start audio only after the first interaction, and every cue here
// answers one.
import { bind, play, playSpec, set, type CueName, type PlayHandle, type ToneLayer } from "@foleyjs/core";
import { cssEasing, easingFunction, gsapEase } from "../lib/eases";

const storageKey = "data-reveal-demo:muted";

// A browser without Web Audio gets no sound at all: Foley isn't set up,
// every cue does nothing, and the Sound switch is hidden.
const audio =
  typeof window.AudioContext === "function" ||
  typeof (window as Window & { webkitAudioContext?: unknown }).webkitAudioContext === "function";

// Quiet overall, and each cue turned down again: these play on every click.
const volume = 0.5;
const levels = {
  tick: 0.35,
  toggle: 0.5,
  slider: 0.25,
  replay: 0.4,
  copied: 0.55,
  ease: 0.5,
};

// Muting drops the engine's gain to zero at once, so the "off" cue that
// confirms it needs this long to play first.
const offCueMs = 220;

function readMuted(): boolean {
  try {
    return localStorage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
}

function storeMuted(value: boolean): void {
  try {
    localStorage.setItem(storageKey, String(value));
  } catch {
    // Without storage the choice lasts until the page closes.
  }
}

let muted = readMuted();
let pendingMute: number | undefined;

function showMuted(): void {
  for (const toggle of document.querySelectorAll<HTMLElement>("[data-sound-toggle]")) {
    toggle.hidden = !audio;
    toggle.setAttribute("aria-checked", String(!muted));
    const state = toggle.querySelector("[data-sound-state]");
    if (state) state.textContent = muted ? "off" : "on";
  }
}

function setMuted(next: boolean): void {
  if (next === muted || !audio) return;
  // A newer choice overrides a mute still waiting on its cue.
  window.clearTimeout(pendingMute);
  pendingMute = undefined;
  muted = next;
  storeMuted(muted);
  showMuted();
  if (!muted) {
    set({ muted: false });
    play("on", { volume: levels.toggle });
    return;
  }
  play("off", { volume: levels.toggle });
  pendingMute = window.setTimeout(() => {
    pendingMute = undefined;
    set({ muted: true });
  }, offCueMs);
}

// Settings sound their value: a slider by where it sits between its min and
// max, a radio by its place among the radios that share its name, left to
// right. Both step up one octave of a pentatonic scale, so a drag sounds
// like a run of notes. A group with more options than the scale has notes
// spreads them across it.
const scale = [0, 2, 4, 7, 9, 12];

function pitchAt(position: number): number {
  const clamped = Math.min(1, Math.max(0, position));
  return scale[Math.round(clamped * (scale.length - 1))];
}

function sliderPitch(input: HTMLInputElement): number {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  return max > min ? pitchAt((Number(input.value) - min) / (max - min)) : scale[0];
}

function radioPitch(input: HTMLInputElement): number {
  const group = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(input.name)}"]`));
  const index = Math.max(0, group.indexOf(input));
  if (group.length <= scale.length) return scale[index];
  return pitchAt(index / (group.length - 1));
}

// Every cue also goes out as a `demo:sound` event, which the tests listen
// for, whether or not Foley played it (its cooldown can drop one).
const report = (detail: Record<string, unknown>): void => {
  document.dispatchEvent(new CustomEvent("demo:sound", { detail }));
};

const cue = (name: CueName, level: number, pitch = 0): void => {
  if (!audio) return;
  const played = play(name, { volume: level, pitch }) !== undefined;
  report({ name, pitch, played });
};

// An ease sounds like itself: one short sine whose pitch follows the curve
// over time, an octave from its start to its end. Back and elastic go past
// the top and settle, bounce bounces, linear glides straight up.
//
// Foley keeps its output to itself (its analyser comes after the volume and
// mute), so a tone of our own couldn't follow the Sound switch. Instead the
// curve is sampled at even steps, and each step is a Foley tone gliding to
// the next one. Foley takes eight of those per performance, so the run is
// split across a few performances started together, each with an id of its
// own so the cooldown lets them through. They go through Foley's volume,
// mute and limiter like every other cue.
const tracePoints = 25;
const traceBase = 392; // G4: 0 on the curve. 1 is G5.
let tracing: PlayHandle[] = [];
let tracedUntil = 0;

// The checked ease: the type's built-in one, or a family in a direction.
function checkedEase(): string | null {
  const family = document.querySelector<HTMLInputElement>('input[name="ease-family"]:checked');
  if (!family) return null;
  if (family.value === "builtin") return family.dataset.ease ?? null;
  const direction = document.querySelector<HTMLInputElement>('input[name="ease-direction"]:checked')?.value ?? "out";
  return gsapEase(family.value, direction as "in" | "out" | "inOut");
}

// As long as the example's own duration, kept between a quarter and a little
// over half a second.
function traceSeconds(): number {
  const duration = Number(document.querySelector<HTMLInputElement>('input[type="range"][data-key="duration"]')?.value);
  return Math.min(0.6, Math.max(0.25, Number.isFinite(duration) ? duration : 0.4));
}

function traceEase(ease: string): void {
  const css = cssEasing[ease];
  if (!css || !audio) return;
  const curve = easingFunction(css);
  // A new pick cuts off the one still sounding.
  const cut = performance.now() < tracedUntil;
  for (const handle of tracing) handle.stop();
  tracing = [];

  const seconds = traceSeconds();
  const step = seconds / (tracePoints - 1);
  const values = Array.from({ length: tracePoints }, (_, i) => curve(i / (tracePoints - 1)));
  const frequency = (value: number): number => traceBase * 2 ** value;
  const layers: ToneLayer[] = values.slice(0, -1).map((value, i) => ({
    kind: "tone",
    at: i * step,
    wave: "sine",
    f: frequency(value),
    f2: frequency(values[i + 1]),
    glide: step,
    a: 0.004,
    d: i === values.length - 2 ? 0.18 : step * 3,
    peak: 0.06,
    send: 0,
  }));
  for (let i = 0; i < layers.length; i += 8) {
    const handle = playSpec(layers.slice(i, i + 8), { id: `ease-${i / 8}`, volume: levels.ease });
    if (handle) tracing.push(handle);
  }
  tracedUntil = performance.now() + seconds * 1000 + 180;
  report({
    name: "ease",
    ease,
    seconds,
    cut,
    played: tracing.length > 0,
    // Semitones above the start at each step: 12 for the end of the curve.
    pitches: values.map((value) => Math.round(value * 1200) / 100),
  });
}

// Once: bind() also sets up the unlock on the first interaction. The router
// keeps the document, so this and the listeners below serve every page.
if (audio) {
  set({ muted, volume });
  bind();
}
showMuted();
document.addEventListener("astro:page-load", showMuted);

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest("[data-sound-toggle]")) {
    setMuted(!muted);
  } else if (target.closest("[data-replay]")) {
    cue("swoosh", levels.replay);
  } else if (target.closest("[data-copy], [role='tab']")) {
    // The copy cue waits for the copy to land, and a tab's for the switch.
  } else if (target.closest("[aria-expanded]")) {
    // A panel or menu button says whether it opened or closed.
    const open = target.closest("[aria-expanded]")?.getAttribute("aria-expanded") === "true";
    cue(open ? "on" : "off", levels.toggle);
  } else if (target.closest("button")) {
    cue("tick", levels.tick);
  }
});

// Captured, so these hear every control whatever stops the event later.
// A slider sounds as it moves, by drag or by arrow key.
document.addEventListener(
  "input",
  (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === "range") cue("tick", levels.slider, sliderPitch(target));
  },
  true,
);

document.addEventListener(
  "change",
  (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement) {
      cue("tick", levels.tick);
    } else if (target instanceof HTMLInputElement) {
      // A switch's cue says its state, so it isn't pitched.
      if (target.type === "checkbox") cue(target.checked ? "on" : "off", levels.toggle);
      else if (target.name === "ease-family" || target.name === "ease-direction") {
        const ease = checkedEase();
        if (ease) traceEase(ease);
      } else if (target.type === "radio") cue("on", levels.toggle, radioPitch(target));
    }
  },
  true,
);

document.addEventListener("demo:copied", () => cue("success", levels.copied));

// The Example and Code tabs, by click or arrow key: a step up the scale per tab.
document.addEventListener("demo:tab", (event) => {
  const index = (event as CustomEvent<{ index: number }>).detail?.index ?? 0;
  cue("switch", levels.toggle, scale[Math.min(index, scale.length - 1)]);
});
