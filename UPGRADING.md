# Upgrading from 0.3 to 0.4

0.4 keeps the same HTML and the same `createReveal()`, `init()`, `refresh()` and `destroy()`, so most sites upgrade by bumping the version. Much of what sites built around 0.3 to make it behave is now part of the package and can go. This guide lists those workarounds, then gives a prompt you can hand to a coding agent to do the clean-up. [CHANGELOG.md](./CHANGELOG.md) has the full list of changes.

## What you can delete

Each workaround below is something sites commonly added to 0.3, with the 0.4 feature that replaces it.

| Workaround in your code | What replaces it in 0.4 |
|---|---|
| Hand-written pre-hide CSS (`[data-reveal] { opacity: 0 }`), an inline failsafe timer that shows content if the script doesn't run, and code in `init().catch()` that marks or shows failed elements | Import `@boccdotdev/data-reveal/reveal.css`. It hides reveal elements only while scripting is on and motion isn't reduced, has a CSS failsafe (`--data-reveal-failsafe`, 5 s by default), and lets go as soon as `init()` sets `data-reveal-state` on the element: `ready`, `skipped` or `failed`. A failed or unknown type no longer stops the rest. Keep the `.catch()` itself: `init()` still rejects when a type fails. In theme CSS that isn't bundled (a Shopify theme's `assets/`, say), the `@import` can't resolve the package, so copy `reveal.css` into your stylesheets instead, and copy it again when you upgrade the package. |
| Excluding `counter` or `parallax` (or types you don't register) from your pre-hide CSS, or forcing them visible | Not needed. `reveal.css` never hides `parallax`, and every element `init()` reaches shows, whatever its type. Under a pre-hide rule of your own, `counter`, `parallax`, skipped and failed elements get `opacity: 1`. |
| Force-visible `!important` rules, and `gsap.set(el, { clearProps: "all" })` after a reveal or after `destroy()`, that exist to undo leftover inline `opacity`, `transform` or `clip-path` | A finished play-once reveal hands every prop it animated back to the element's CSS, so nothing is left inline, and `destroy()` puts elements back as they were before `init()`. Keep the end state inline with `data-reveal-keep` if you need it. Keep `!important` rules that show reveals which never get scrolled to, such as ones in menus, modals or tabs. |
| Rules or code that re-apply an element's own `opacity` or `transform` after its reveal (a `.muted` element ending at 1, a centred element jumping) | Reveals end at the element's own opacity and transform, including Tailwind v4's `translate`, `rotate` and `scale` utilities. |
| The same `data-reveal-duration`, `-ease`, `-start` (and so on) repeated across templates, or a template-level map from component to attribute values | `createReveal({ defaults, typeDefaults })`, with `data-reveal-ease` and `ease` available too. Some global defaults don't reach every type: `duration`, `ease` and `from` don't reach `counter`, `start` and `end` don't reach `parallax`, `from` doesn't reach `scale`, and `stagger` doesn't reach `split`. Set those in `typeDefaults`. A global `start` also replaces the built-in start that reaches the end of the page. |
| A custom `reveal:refresh` window event, or direct `ScrollTrigger.refresh()` or `ScrollTrigger.refresh(true)` calls after layout changes | `reveal.refresh()`. It runs in ScrollTrigger's safe mode, about 200 ms later once scrolling stops, so it doesn't cut a smooth scroll short. It returns a promise that resolves once positions are recomputed, so `await` it before measuring or scrolling. A call that needs your own ScrollTriggers refreshed at once can stay `ScrollTrigger.refresh()`. |
| A patch to `SplitText.create` that forces `aria: "none"`, and waiting on `document.fonts.ready` before calling `init()` | `split` picks accessible defaults itself (`data-reveal-aria`), and a `lines` split splits again when a web font loads or the width changes. |
| `data-reveal-start="top bottom"` or `"top 100%"` on footer reveals so they play at all | The built-in start reaches content near the end of the page, and plays straight away on a page too short to scroll. That only holds while no `start` is set in `defaults` or `typeDefaults` for the type. |
| `init()` on a container's parent, or an extra check, because `init(container)` skipped the container itself | `init(container)` includes the container when it's a reveal element itself. |
| `setTimeout` delays or flags around `destroy()` and `init()` in page transitions, to stop a slow `init()` arming content that's already gone | `destroy()` covers an `init()` that's still loading: it skips what you destroyed. A delay that waits for layout instead (Barba keeps the old container until after `afterEnter`, for one) still matters; follow it with `reveal.refresh()`. |
| Load-more cards turned into separate `fade`s with hand-computed `data-reveal-delay` per column, or code that reads inline `opacity` to tell revealed items from new ones, then calls `destroy(container)` and `init(container)` | Append the items and call `init()` over the `batch` again. Only the new items reveal, staggered as they enter, and `data-reveal-state="done"` tells you when the batch has finished. |
| Stripping inline styles from `batch` items hidden at init (closed panels, items hidden below a breakpoint), or taking `batch` off a grid because of them | A `batch` item with no size when it arms waits until it gets one, then reveals as it's scrolled to. Inside carousels and horizontal tracks, keep the reveal on the wrapper, not the items: the items scroll sideways, past the page's scroll position. |
| Print styles with `!important` to show reveals that hadn't played | Printing plays pending reveals to their end first, and `reveal.css` has print rules for printing that skips `beforeprint`. Remove yours only if you import `reveal.css` (or a copy of it). |
| `transform: none !important` (or similar) under `prefers-reduced-motion` "to be safe" | Under reduced motion nothing animates and nothing is set inline beyond `opacity: 1` under a site pre-hide and a counter's text. The rule only wipes transforms your design relies on. |

Keep these for now:

- **Guards that keep `counter` to digits only**, or that rebuild its text around the number. `counter` still writes plain digits with `prefix` and `suffix`, and drops other text around the number (#14).

## Behaviour changes to check

None of these need code changes, but check them on your site:

- `split` pieces are `<span>`s with the classes `data-reveal-char`, `data-reveal-word` and `data-reveal-line`, not `<div>`s. Update any CSS that styles split pieces by tag.
- `data-reveal-state` goes from `ready` to `done` when a play-once reveal finishes. Test for the attribute being there rather than for `ready`.
- `destroy()` puts elements back as they were before `init()` by default. Pass `{ revert: false }` for 0.3's behaviour.
- `refresh()`, and the refresh after `init()`, run about 200 ms later, once scrolling has stopped.
- Reveals end at the element's own opacity and transform, and leave nothing inline once they finish.
- Elements whose reveal isn't at its end carry `data-reveal-pending`.
- Call `init()` for appended content in the same task as the append, before the browser paints, or items already on screen replay.
- Each instance's `destroy()` tears down only the reveals that instance armed.

## A prompt for your coding agent

Copy this into a coding agent (any agent, any framework) at the root of your project:

```text
Upgrade @boccdotdev/data-reveal from 0.3 to 0.4 in this project and remove the
workarounds 0.4 makes unnecessary. Work in small, reviewable steps.

1. Bump the dependency to "^0.4.0" in package.json and update the lockfile with
   the project's package manager. Make sure "gsap" (3.13 or later) is listed as a
   dependency too; the package doesn't bring it.

2. Search the whole codebase (scripts, stylesheets, templates, theme files) for
   each pattern below, and note every match with its file and line:
   a. CSS that hides [data-reveal] or [data-reveal="..."] elements before init
      (opacity: 0, visibility: hidden), any timer that shows them if the script
      fails, and code inside init().catch() that marks or shows failed
      elements.
   b. Rules or code that exclude counter, parallax or unregistered types from
      that pre-hide, or force them visible.
   c. Force-visible !important rules on reveal elements, and gsap.set(...,
      { clearProps }) or similar resets run after a reveal or after destroy(),
      that exist to undo leftover inline opacity, transform or clip-path.
   d. Code that re-applies an element's own opacity or transform after its
      reveal.
   e. data-reveal-* attribute values (duration, ease, start, distance, stagger
      and so on) repeated across many templates, and template-level maps from
      components to those values.
   f. Custom events such as "reveal:refresh", and direct ScrollTrigger.refresh()
      or ScrollTrigger.refresh(true) calls made after layout changes.
   g. Patches or wrappers around SplitText.create (for example forcing
      aria: "none"), and code that waits for document.fonts.ready before
      calling init().
   h. data-reveal-start="top bottom" or "top 100%" used so footer content
      reveals.
   i. setTimeout delays or flags around destroy() and init() in page
      transition hooks, and what each one is waiting for.
   j. Load-more or infinite-scroll code that turns batch items into separate
      fades with computed delays, reads inline opacity to tell revealed items
      from new ones, or calls destroy(container) then init(container) to pick
      up new items.
   k. Code that strips inline styles from hidden batch items, or avoids batch
      on responsive grids because of items hidden at some breakpoints.
   l. Print styles that force reveal elements visible with !important.
   m. Reduced-motion rules that force transform: none or opacity: 1 on reveal
      elements.

3. Change what 0.4 covers:
   - Where a pre-hide existed (a), replace it with
     @import "@boccdotdev/data-reveal/reveal.css";
     in a stylesheet loaded in <head>. If that stylesheet isn't processed by a
     bundler or PostCSS (theme CSS served as is, for example), the import
     can't resolve the package: copy node_modules/@boccdotdev/data-reveal/
     reveal.css into the project's stylesheets instead, and note that it needs
     copying again on each package upgrade. Then remove the old
     rules and failsafe timers. Keep any .catch() on init(), because init()
     still rejects when a type fails to load; remove only the code inside it
     that marks or shows failed elements.
   - Remove (b), (d) and (m).
   - Remove (c) only where it undoes leftover inline styles after a reveal or
     destroy(). Keep rules that show reveals which never get scrolled to, such
     as ones in menus, modals or tabs.
   - Move repeated values (e) into createReveal({ defaults, typeDefaults }),
     keeping any attribute that differs from the default. Global defaults
     don't reach every type: duration, ease and from don't reach counter;
     start and end don't reach parallax; from doesn't reach scale; stagger
     doesn't reach split. Put those in typeDefaults for the type. Leave start
     out of defaults unless the site already sets one everywhere: a global
     start replaces the built-in start that reaches the end of the page.
   - Remove (h), the footer starts, only if no start is set in defaults or
     in typeDefaults for those types.
   - Replace (f) with reveal.refresh() on the shared instance. It runs about
     200 ms later, once scrolling stops, so code that measures or scrolls
     straight after it needs await reveal.refresh(). Leave a direct
     ScrollTrigger.refresh() where the site's own ScrollTriggers need
     refreshing at once.
   - Remove (g); split's ARIA defaults and re-splitting cover it.
   - Remove a delay or flag in (i) only when it was there to stop a slow
     init() arming content that's gone. Keep delays that wait for layout:
     Barba, for one, keeps the old container until after afterEnter. Follow
     those with reveal.refresh().
   - Replace (j) with: append the new items, then call init() on the batch
     container in the same task, before the browser paints.
   - Remove (k), and put batch back on grids where it was avoided because of
     hidden items. Don't put batch on the items of a carousel or a horizontal
     scroll track; keep a single reveal on its wrapper.
   - Remove (l) only if the project imports reveal.css (or a copy of it),
     which carries print rules.
   Only remove a workaround when you're sure it exists for one of these
   reasons. If you're unsure, leave it and list it in your report.

4. Leave alone any guard that keeps counter text to digits only, or that
   rebuilds the text around a counter's number. 0.4 doesn't fix that yet.

5. Run the project's build and tests.

6. Report back with:
   - each change you made, by file;
   - each match you left alone, and why;
   - this checklist of 0.4 behaviour changes for a human to check in the
     browser:
     * split pieces are <span>s with the classes data-reveal-char,
       data-reveal-word and data-reveal-line, so CSS that styles them by tag
       (div) needs the classes;
     * data-reveal-state changes from "ready" to "done" when a play-once reveal
       finishes, so CSS or code that tests for "ready" may stop matching;
     * destroy() now puts elements back as they were before init(); pass
       { revert: false } to keep 0.3's behaviour;
     * refresh(), and the refresh after init(), run about 200 ms later, once
       scrolling has stopped;
     * reveals end at the element's own opacity and transform and leave nothing
       inline when they finish;
     * elements whose reveal hasn't finished carry data-reveal-pending;
     * init() for appended content must run before the browser paints it, or
       items already on screen replay;
     * each instance's destroy() only tears down the reveals it armed.
```
