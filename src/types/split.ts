import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { registry } from "../core/registry.js";
import { finish, unhide } from "../core/visibility.js";
import { revealCallbacks } from "../internal/finish.js";
import { option, options } from "../internal/options.js";
import { cleansUp, revealTrigger } from "../internal/trigger.js";
import type { RevealInit, RevealRegistration, SplitAria, SplitType } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger, SplitText);

// How the split text reaches assistive tech, unless `aria` says otherwise.
// Words and lines keep the real text in the page, so they're read as they
// are ("none"). One inline-block element per character is read letter by
// letter ("R e a d"), so chars hide each word's pieces and put a visually
// hidden copy of the word in front of it ("hidden"). That keeps the
// element's own role and links working: nothing focusable ends up inside an
// aria-hidden element. SplitText's own "auto" puts an aria-label on the
// element instead, which a plain <p>, <span> or <div> doesn't allow, so
// assistive tech reads nothing there.
function ariaFor(splitType: SplitType, chosen: SplitAria | undefined): SplitAria {
  if (chosen === "auto" || chosen === "hidden" || chosen === "none") return chosen;
  return splitType === "chars" ? "hidden" : "none";
}

// For "hidden": hide each piece from assistive tech, with a visually hidden
// copy of its text just before it. The copies can't be selected, so copying
// the text doesn't copy each word twice. Reverting the split restores the
// element's own HTML, which removes the copies, and a re-split adds them
// again.
function readCopiesInstead(pieces: Element[]): void {
  for (const piece of pieces) {
    const copy = document.createElement("span");
    copy.textContent = piece.textContent;
    Object.assign(copy.style, {
      position: "absolute",
      width: "1px",
      height: "1px",
      margin: "-1px",
      padding: "0",
      border: "0",
      overflow: "hidden",
      clip: "rect(0 0 0 0)",
      clipPath: "inset(50%)",
      whiteSpace: "nowrap",
      userSelect: "none",
      webkitUserSelect: "none",
    });
    piece.before(copy);
    piece.setAttribute("aria-hidden", "true");
  }
}

export const init: RevealInit = (el, ctx) => {
  if (ctx.reduced) {
    unhide(el);
    return;
  }

  const { split: splitType, stagger, duration, delay, ease } = options(el, ctx, {
    split: "chars",
    stagger: 0.02,
    duration: 0.5,
    delay: 0,
    ease: "back.out(1.7)",
  });
  const aria = ariaFor(splitType, option(el, ctx, "aria"));
  const cleanUp = cleansUp(el, ctx);
  unhide(el);

  // The tween for the current split, and how many splits there have been.
  // Each re-split builds a new tween. `unwatchFonts` ends the WebKit fonts
  // check below.
  let tween: gsap.core.Tween | undefined;
  let splits = 0;
  let unwatchFonts = (): void => {};

  const vars: SplitText.Vars = {
    // Splitting words alongside chars wraps each char in an inline-block
    // word, so a word wraps as a unit instead of breaking between letters.
    type: splitType === "chars" ? "words, chars" : splitType,
    aria: aria === "auto" ? "auto" : "none",
    // Re-split when fonts finish loading or the element's width changes,
    // including when an element split before it was in the page gets a size.
    // SplitText only does this for lines, the one split that depends on
    // layout.
    autoSplit: true,
    // Runs on every split. SplitText reverts the previous tween (and its
    // ScrollTrigger) first, and takes the new one to the same point in time.
    onSplit(self) {
      splits++;
      if (aria === "hidden") readCopiesInstead(splitType === "lines" ? self.lines : self.words);
      const targets = self[splitType];
      gsap.set(targets, { opacity: 0, yPercent: 60 });
      if (tween) registry.forget(el, tween);
      tween = gsap.to(targets, {
        opacity: 1,
        yPercent: 0,
        duration,
        stagger,
        delay,
        ease,
        scrollTrigger: revealTrigger(el, ctx),
        // A finished play-once split puts the element's own HTML back: best
        // for assistive tech and copying, and nothing left to re-split.
        ...revealCallbacks(el, {
          target: el,
          cleanUp,
          onFinish: () => {
            unwatchFonts();
            self.revert();
            finish(el);
          },
        }),
      });
      registry.track(el, tween);
      return tween;
    },
  };
  const split = SplitText.create(el, vars);
  registry.addSplit(el, split);

  // autoSplit re-splits lines on the font set's `loadingdone` event, which
  // WebKit doesn't fire for a font that starts loading after the split. Its
  // `ready` promise does settle, so re-split then if nothing else has.
  if (splitType === "lines" && document.fonts) {
    const fonts = document.fonts;
    const onLoading = (): void => {
      const before = splits;
      void fonts.ready.then(() => {
        if (split.isSplit && splits === before) split.split(vars);
      });
    };
    unwatchFonts = () => fonts.removeEventListener("loading", onLoading);
    fonts.addEventListener("loading", onLoading);
    registry.add(el, { kill: unwatchFonts });
  }
};

export const split: RevealRegistration = { type: "split", init };
