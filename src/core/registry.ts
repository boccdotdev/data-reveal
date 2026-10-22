import { pendingAttribute } from "./state.js";

interface Killable {
  kill: () => void;
}

interface Revertable {
  revert: () => void;
}

interface Trackable extends Killable {
  scrollTrigger?: Killable;
}

/** What a reveal does around printing: `before` shows it at its end, `after` undoes what has to be. */
export interface Printer {
  before: () => void;
  after: () => void;
}

// What an element looked like before init() touched it, so destroy() can put
// it back and a finished reveal can hand its animated props back. An element
// two reveals style (a batch item that is also a fade) shares one snapshot,
// taken by whichever armed first, so neither records the other's starting
// state as the element's own.
interface Snapshot {
  target: HTMLElement;
  // The reveals using this snapshot. A new reveal joins it while any remain.
  owners: Set<Element>;
  // Whether an earlier reveal had styled the target before this snapshot.
  rerun: boolean;
  style: string | null;
  // The inline value and priority of each animated prop, "" when unset.
  props: Array<[prop: string, value: string, priority: string]>;
  // GSAP transforms SVG elements through attributes, so those are recorded
  // too: the value of each, or null when unset.
  attributes: Array<[name: string, value: string | null]>;
  // The text destroy() leaves, for types that rewrite it, like counter, and
  // the reveal that rewrites it.
  text?: string;
  textOwner?: Element;
  // Run just before destroy() puts the target back (see resetOnRestore()).
  reset?: () => void;
}

interface Entry {
  el: Element;
  killables: Killable[];
  revertables: Revertable[];
  snapshots: Snapshot[];
  printers: Set<Printer>;
  // The play-once reveal has finished, so it won't change its targets again.
  finished: boolean;
  // It also handed everything back, so it can be dropped once every reveal
  // it shares a snapshot with can too.
  releasable: boolean;
}

// A reveal that left a target to another reveal, and what to do once that
// one is done with it.
interface Yielded {
  el: Element;
  done: () => void;
}

// Which entries a kill applies to, by the element each reveal is on: the
// core passes the ones its own instance armed.
type Owned = (el: Element) => boolean;
const everything: Owned = () => true;

// The props the built-in types animate or set while animating. GSAP writes
// the individual `translate`, `rotate` and `scale` props alongside `transform`.
const animatedProps = [
  "opacity",
  "transform",
  "translate",
  "rotate",
  "scale",
  "transform-origin",
  "clip-path",
  "filter",
];

// The attributes GSAP sets on an SVG element it transforms.
const svgAttributes = ["transform", "data-svg-origin"];

type Restore = "none" | "animated" | "style";

class RevealRegistry {
  // One entry per element a reveal is on, in the order they were armed.
  private entries = new Map<Element, Entry>();
  // The live snapshot of each target, for sharing and for finish().
  private snapshotOf = new WeakMap<HTMLElement, Snapshot>();
  // Every target a reveal has snapshotted, so a later run knows it's one.
  private snapshotted = new WeakSet<HTMLElement>();
  // The reveals animating each target right now: one is added when its tween
  // on the target starts, and removed when that tween completes, is
  // interrupted, or its reveal is killed.
  private running = new WeakMap<HTMLElement, Set<Element>>();
  // The reveals that left each target to the one animating it (yieldTo()).
  private yielded = new WeakMap<HTMLElement, Yielded[]>();
  // How a reveal picks up content added to its element since it armed (a
  // batch's new items). Kept after release, so a finished batch can take on
  // more items; dropped when the reveal is killed.
  private rescans = new WeakMap<Element, () => boolean>();
  // The reveals that animate their targets themselves and hand them back when
  // they finish (handsBack()), so putting a shared target back can wait for
  // them. Kept after release too, for the targets a rescan adds.
  private handingBack = new WeakSet<Element>();

  private entryFor(el: Element): Entry {
    let entry = this.entries.get(el);
    if (!entry) {
      entry = {
        el,
        killables: [],
        revertables: [],
        snapshots: [],
        printers: new Set(),
        finished: false,
        releasable: false,
      };
      this.entries.set(el, entry);
    }
    return entry;
  }

  /** How many reveals the registry holds. For tests. */
  get size(): number {
    return this.entries.size;
  }

  add(el: Element, trigger: Killable): void {
    this.entryFor(el).killables.push(trigger);
  }

  /** How the reveal on `el` shows itself at its end for printing. */
  onPrint(el: Element, printer: Printer): void {
    this.entryFor(el).printers.add(printer);
  }

  /** Runs `before` or `after` for every reveal `owned` accepts, before or after printing. */
  print(owned: Owned, phase: keyof Printer): void {
    for (const entry of Array.from(this.entries.values())) {
      if (owned(entry.el)) entry.printers.forEach((printer) => printer[phase]());
    }
  }

  /** How the reveal on `el` takes on content added since it armed. See rescan(). */
  onRescan(el: Element, rescan: () => boolean): void {
    this.rescans.set(el, rescan);
  }

  /**
   * Gives the reveal on `el`, armed earlier, the chance to take on content
   * added since. Returns whether it armed anything.
   */
  rescan(el: Element): boolean {
    const armed = this.rescans.get(el)?.() ?? false;
    if (armed) this.reopen(el);
    return armed;
  }

  /**
   * The reveal on `el` has something to play again (a batch's new items), so
   * it's no longer finished: a release it was waiting on mustn't take the new
   * work with it.
   */
  reopen(el: Element): void {
    const entry = this.entries.get(el);
    if (entry) entry.finished = entry.releasable = false;
  }

  /** Something to revert when the reveal on `el` is killed, such as its split. Never on release(). */
  addRevert(el: Element, revertable: Revertable): void {
    this.entryFor(el).revertables.push(revertable);
  }

  /**
   * Run `reset` whenever destroy() or the throw path puts `target` back, just
   * before its inline styles go back, so the engine can bring its own record
   * of the target in line (GSAP's cached transform). Not when a finished
   * reveal hands the props back: it ended where that record says.
   */
  resetOnRestore(target: HTMLElement, reset: () => void): void {
    const snapshot = this.snapshotOf.get(target);
    if (snapshot) snapshot.reset = reset;
  }

  track(el: Element, tween: Trackable): void {
    const entry = this.entryFor(el);
    entry.killables.push(tween);
    if (tween.scrollTrigger) entry.killables.push(tween.scrollTrigger);
  }

  /**
   * Record how `target` looks now, owned by the reveal on `el`. The core
   * snapshots every element before its type's init runs; a type snapshots any
   * other element it styles (batch items). If another reveal already holds a
   * snapshot of `target`, this one shares it. Pass `text` to set the text
   * `destroy()` leaves (counter). Call it before changing anything.
   */
  snapshot(el: Element, target: HTMLElement, { text }: { text?: string } = {}): void {
    const entry = this.entryFor(el);
    let snapshot = this.snapshotOf.get(target);
    if (!snapshot || snapshot.owners.size === 0) {
      snapshot = {
        target,
        owners: new Set(),
        rerun: this.snapshotted.has(target),
        style: target.getAttribute("style"),
        props: animatedProps.map((prop) => [
          prop,
          target.style.getPropertyValue(prop),
          target.style.getPropertyPriority(prop),
        ]),
        attributes:
          target instanceof SVGElement ? svgAttributes.map((name) => [name, target.getAttribute(name)]) : [],
      };
      this.snapshotOf.set(target, snapshot);
      this.snapshotted.add(target);
    }
    if (!snapshot.owners.has(el)) {
      snapshot.owners.add(el);
      entry.snapshots.push(snapshot);
    }
    if (text !== undefined) {
      snapshot.text = text;
      snapshot.textOwner = el;
    }
  }

  /**
   * Whether `target`'s current styles might not be its own: an earlier reveal
   * styled it (a re-init), or another reveal shares its snapshot and may have
   * set a starting state already.
   */
  styledBefore(target: HTMLElement): { rerun: boolean; shared: boolean } {
    const snapshot = this.snapshotOf.get(target);
    return { rerun: !!snapshot?.rerun, shared: (snapshot?.owners.size ?? 0) > 1 };
  }

  /** The reveal on `el` started animating `target`. */
  started(el: Element, target: HTMLElement): void {
    let reveals = this.running.get(target);
    if (!reveals) this.running.set(target, (reveals = new Set()));
    reveals.add(el);
  }

  /** The reveal on `el` stopped animating `target`: finished or interrupted. */
  stopped(el: Element, target: HTMLElement): void {
    this.running.get(target)?.delete(el);
  }

  /**
   * The reveal on `el` animates its targets themselves and hands them back
   * when it finishes: a play-once reveal that cleans up. Not a split, which
   * animates its pieces, nor one with `reverse` or `keep`.
   */
  handsBack(el: Element): void {
    this.handingBack.add(el);
  }

  /** Whether a reveal has hidden `target` itself: an inline `opacity: 0` its snapshot didn't record. */
  hiddenByReveal(target: HTMLElement): boolean {
    const snapshot = this.snapshotOf.get(target);
    if (!snapshot || snapshot.owners.size === 0 || target.style.opacity !== "0") return false;
    return snapshot.props.find(([prop]) => prop === "opacity")?.[1] !== "0";
  }

  /** Whether any reveal is animating `target` right now. */
  animating(target: HTMLElement): boolean {
    return (this.running.get(target)?.size ?? 0) > 0;
  }

  /** Whether a reveal other than the one on `el` is animating `target` right now. */
  animatedByOthers(el: Element, target: HTMLElement): boolean {
    for (const other of this.running.get(target) ?? []) if (other !== el) return true;
    return false;
  }

  /**
   * The reveal on `el` leaves `target` to the reveal animating it, so the two
   * don't fight over it. `done` runs once that one is done with it: after it
   * has handed the props back (settle()), or once it's killed.
   */
  yieldTo(el: Element, target: HTMLElement, done: () => void): void {
    let waiting = this.yielded.get(target);
    if (!waiting) this.yielded.set(target, (waiting = []));
    waiting.push({ el, done });
  }

  /** No reveal is animating `target` any more: finish the ones that yielded it. */
  settle(target: HTMLElement): void {
    const waiting = this.yielded.get(target);
    if (!waiting) return;
    this.yielded.delete(target);
    waiting.forEach(({ done }) => done());
  }

  /** Drop a tween the registry no longer needs to kill, e.g. one a re-split replaced. */
  forget(el: Element, tween: Trackable): void {
    const entry = this.entries.get(el);
    if (!entry) return;
    entry.killables = entry.killables.filter((k) => k !== tween && k !== tween.scrollTrigger);
  }

  /**
   * The play-once reveal on `el` has finished, but keeps what it left inline
   * (`keep`), so it stays for destroy() to put back. It no longer holds back
   * putting a shared target back when another reveal on it is killed.
   */
  finished(el: Element): void {
    const entry = this.entries.get(el);
    if (entry) entry.finished = true;
  }

  /**
   * The play-once reveal on `el` has finished and handed its props back, so
   * nothing is left to undo: kill what it registered (a spent trigger, the
   * finished tween) and drop its entry. A reveal that shares a snapshot with
   * one still to finish (a batch item that is also a fade) waits for it, and
   * they're dropped together.
   */
  release(el: Element): void {
    const entry = this.entries.get(el);
    if (!entry) return;
    entry.finished = entry.releasable = true;
    const group = new Set<Entry>();
    const pending = [entry];
    for (let next = pending.pop(); next; next = pending.pop()) {
      if (group.has(next)) continue;
      if (!next.releasable) return;
      group.add(next);
      for (const snapshot of next.snapshots) {
        for (const owner of snapshot.owners) {
          const other = this.entries.get(owner);
          if (other) pending.push(other);
        }
      }
    }
    for (const done of group) {
      this.entries.delete(done.el);
      done.killables.forEach((k) => k.kill());
      for (const snapshot of done.snapshots) snapshot.owners.delete(done.el);
    }
  }

  /**
   * Hand the animated props back to `target`'s own CSS: each goes back to the
   * inline value it had before init(), or is removed. Other inline styles,
   * including ones a site set meanwhile, stay as they are.
   */
  restoreAnimated(target: HTMLElement): void {
    const snapshot = this.snapshotOf.get(target);
    if (snapshot) this.putBack(snapshot, "animated");
  }

  private putBack(snapshot: Snapshot, restore: Restore): void {
    const { target } = snapshot;
    for (const [name, value] of snapshot.attributes) {
      if (value === null) target.removeAttribute(name);
      else target.setAttribute(name, value);
    }
    if (restore === "style") {
      if (snapshot.style === null) target.removeAttribute("style");
      else target.setAttribute("style", snapshot.style);
    } else {
      for (const [prop, value, priority] of snapshot.props) {
        if (value) target.style.setProperty(prop, value, priority);
        else target.style.removeProperty(prop);
      }
      if (target.getAttribute("style") === "") target.removeAttribute("style");
    }
  }

  // Each kill method returns the elements whose entries it killed. `restore`
  // puts a snapshot back once no reveal is animating its target any more:
  // "animated" puts back only the animated props (and text), keeping any
  // other inline styles a site set since init(); "style" puts back the whole
  // style attribute. `owned` limits it to the reveals on the elements it
  // accepts.
  killAll({ restore = "none", owned = everything }: { restore?: Restore; owned?: Owned } = {}): Element[] {
    return this.killWhere(owned, restore);
  }

  // Kill only the entries whose element is the container or lives inside it.
  // `contains` works on detached subtrees too, so a removed-then-destroyed
  // container is still cleaned up.
  kill(
    container: ParentNode,
    { restore = "none", owned = everything }: { restore?: Restore; owned?: Owned } = {},
  ): Element[] {
    return this.killWhere((el) => (el === container || (container as Node).contains(el)) && owned(el), restore);
  }

  // Kill only what is registered to this exact element. Unlike kill(el), it
  // leaves reveals nested inside the element running.
  killElement(el: Element, { restore = "none" }: { restore?: Restore } = {}): void {
    const entry = this.entries.get(el);
    if (!entry) return;
    this.entries.delete(el);
    this.killEntry(entry, restore);
  }

  private killWhere(match: Owned, restore: Restore): Element[] {
    const killed = Array.from(this.entries.values()).filter((entry) => match(entry.el));
    // Out of the registry first, so a callback a kill sets off (a tween's
    // onInterrupt) finds nothing to change.
    killed.forEach((entry) => this.entries.delete(entry.el));
    killed.forEach((entry) => this.killEntry(entry, restore));
    return killed.map((entry) => entry.el);
  }

  // Whether another reveal on the snapshot's target is still to play or
  // playing there and will hand the target back itself: one that handsBack(),
  // isn't finished and hasn't yielded it. One that won't (a split, or a
  // reverse or keep reveal) would leave the target as this reveal hid it.
  private pending(snapshot: Snapshot): boolean {
    const yielded = this.yielded.get(snapshot.target) ?? [];
    for (const owner of snapshot.owners) {
      const entry = this.entries.get(owner);
      if (entry && this.handingBack.has(owner) && !entry.finished && !yielded.some((y) => y.el === owner)) return true;
    }
    return false;
  }

  // Whether the reveal on `el` is still live: its entry is there (killed ones
  // are gone) and it hasn't finished.
  private live(el: Element | undefined): boolean {
    const entry = el && this.entries.get(el);
    return !!entry && !entry.finished;
  }

  // Stop the animations first so nothing writes to the element afterwards,
  // then undo the split, then put back what the snapshots recorded.
  private killEntry(entry: Entry, restore: Restore): void {
    this.rescans.delete(entry.el);
    this.handingBack.delete(entry.el);
    entry.killables.forEach((k) => k.kill());
    entry.revertables.forEach((r) => r.revert());
    for (const snapshot of entry.snapshots) {
      const { target } = snapshot;
      snapshot.owners.delete(entry.el);
      this.stopped(entry.el, target);
      const waiting = this.yielded.get(target);
      if (waiting) this.yielded.set(target, waiting.filter((y) => y.el !== entry.el));
      // Put the target back unless nothing is to be restored, or another
      // reveal on it is animating it or still to play there (another
      // instance's, say) and will hand it back itself.
      if (restore !== "none" && !this.animating(target) && !this.pending(snapshot)) {
        // The text is the counter's: while it's still to count, it's left alone.
        if (snapshot.text !== undefined && !this.live(snapshot.textOwner)) target.textContent = snapshot.text;
        snapshot.reset?.();
        this.putBack(snapshot, restore);
        // Back at rest, so print shows it as it is.
        target.removeAttribute(pendingAttribute);
      }
      if (!this.animating(target)) this.settle(target);
    }
  }
}

export const registry = new RevealRegistry();
