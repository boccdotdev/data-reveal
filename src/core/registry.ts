interface Killable {
  kill: () => void;
}

interface Revertable {
  revert: () => void;
}

interface Trackable extends Killable {
  scrollTrigger?: Killable;
}

class RevealRegistry {
  private triggers: Killable[] = [];
  private splits: Revertable[] = [];
  private tweens: Killable[] = [];

  add(trigger: Killable): void {
    this.triggers.push(trigger);
  }

  addSplit(split: Revertable): void {
    this.splits.push(split);
  }

  track(tween: Trackable): void {
    this.tweens.push(tween);
    if (tween.scrollTrigger) this.triggers.push(tween.scrollTrigger);
  }

  killAll(): void {
    this.tweens.forEach((t) => t.kill());
    this.triggers.forEach((t) => t.kill());
    this.splits.forEach((s) => s.revert());
    this.tweens = [];
    this.triggers = [];
    this.splits = [];
  }
}

export const registry = new RevealRegistry();
