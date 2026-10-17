interface Killable {
  kill: () => void;
}

interface Revertable {
  revert: () => void;
}

interface Trackable extends Killable {
  scrollTrigger?: Killable;
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
  // The text destroy() leaves, for types that rewrite it, like counter.
  text?: string;
}

interface Entry {
  el: Element;
  killables: Killable[];
  revertables: Revertable[];
  snapshots: Snapshot[];
}

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
  private entries: Entry[] = [];
  // The live snapshot of each target, for sharing and for finish().
  private snapshotOf = new WeakMap<HTMLElement, Snapshot>();
  // Every target a reveal has snapshotted, so a later run knows it's one.
  private snapshotted = new WeakSet<HTMLElement>();
  // The reveals animating each target right now: one is added when its tween
  // on the target starts, and removed when that tween completes, is
  // interrupted, or its reveal is killed.
  private running = new WeakMap<HTMLElement, Set<Element>>();

  private entryFor(el: Element): Entry {
    let entry = this.entries.find((e) => e.el === el);
    if (!entry) {
      entry = { el, killables: [], revertables: [], snapshots: [] };
      this.entries.push(entry);
    }
    return entry;
  }

  add(el: Element, trigger: Killable): void {
    this.entryFor(el).killables.push(trigger);
  }

  addSplit(el: Element, split: Revertable): void {
    this.entryFor(el).revertables.push(split);
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
    if (text !== undefined) snapshot.text = text;
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

  /** Whether any reveal is animating `target` right now. */
  animating(target: HTMLElement): boolean {
    return (this.running.get(target)?.size ?? 0) > 0;
  }

  /** Drop a tween the registry no longer needs to kill, e.g. one a re-split replaced. */
  forget(el: Element, tween: Trackable): void {
    const entry = this.entries.find((e) => e.el === el);
    if (!entry) return;
    entry.killables = entry.killables.filter((k) => k !== tween && k !== tween.scrollTrigger);
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
  // style attribute.
  killAll({ restore = "none" }: { restore?: Restore } = {}): Element[] {
    const killed = this.entries;
    killed.forEach((entry) => this.killEntry(entry, restore));
    this.entries = [];
    return killed.map((entry) => entry.el);
  }

  // Kill only the entries whose element is the container or lives inside it.
  // `contains` works on detached subtrees too, so a removed-then-destroyed
  // container is still cleaned up.
  kill(container: ParentNode, { restore = "none" }: { restore?: Restore } = {}): Element[] {
    const remaining: Entry[] = [];
    const killed: Element[] = [];
    for (const entry of this.entries) {
      if (entry.el === container || (container as Node).contains(entry.el)) {
        this.killEntry(entry, restore);
        killed.push(entry.el);
      } else {
        remaining.push(entry);
      }
    }
    this.entries = remaining;
    return killed;
  }

  // Kill only what is registered to this exact element. Unlike kill(el), it
  // leaves reveals nested inside the element running.
  killElement(el: Element, { restore = "none" }: { restore?: Restore } = {}): void {
    const entry = this.entries.find((e) => e.el === el);
    if (!entry) return;
    this.killEntry(entry, restore);
    this.entries = this.entries.filter((e) => e !== entry);
  }

  // Stop the animations first so nothing writes to the element afterwards,
  // then undo the split, then put back what the snapshots recorded.
  private killEntry(entry: Entry, restore: Restore): void {
    entry.killables.forEach((k) => k.kill());
    entry.revertables.forEach((r) => r.revert());
    for (const snapshot of entry.snapshots) {
      snapshot.owners.delete(entry.el);
      this.stopped(entry.el, snapshot.target);
      // Another reveal is still animating the target and will hand it back
      // when it finishes, or nothing is to be restored. A reveal that has
      // already finished on it, or hasn't started, doesn't hold it back.
      if (this.animating(snapshot.target) || restore === "none") continue;
      if (snapshot.text !== undefined) snapshot.target.textContent = snapshot.text;
      this.putBack(snapshot, restore);
    }
  }
}

export const registry = new RevealRegistry();
