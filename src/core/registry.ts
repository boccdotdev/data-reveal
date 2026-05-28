interface Killable {
  kill: () => void;
}

interface Revertable {
  revert: () => void;
}

interface Trackable extends Killable {
  scrollTrigger?: Killable;
}

interface Entry {
  el: Element;
  killables: Killable[];
  revertables: Revertable[];
}

class RevealRegistry {
  private entries: Entry[] = [];

  private entryFor(el: Element): Entry {
    let entry = this.entries.find((e) => e.el === el);
    if (!entry) {
      entry = { el, killables: [], revertables: [] };
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

  killAll(): void {
    this.entries.forEach((entry) => this.killEntry(entry));
    this.entries = [];
  }

  // Kill only the entries whose element is the container or lives inside it.
  // `contains` works on detached subtrees too, so a removed-then-destroyed
  // container is still cleaned up.
  kill(container: ParentNode): void {
    const remaining: Entry[] = [];
    for (const entry of this.entries) {
      if (entry.el === container || (container as Node).contains(entry.el)) {
        this.killEntry(entry);
      } else {
        remaining.push(entry);
      }
    }
    this.entries = remaining;
  }

  private killEntry(entry: Entry): void {
    entry.killables.forEach((k) => k.kill());
    entry.revertables.forEach((r) => r.revert());
  }
}

export const registry = new RevealRegistry();
