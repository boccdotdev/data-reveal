# Changelog

## 0.4.0 (2026-10-18)

The HTML and the `createReveal()`, `init()`, `refresh()` and `destroy()` calls are unchanged, so most sites upgrade by bumping the version. [UPGRADING.md](./UPGRADING.md) lists the workarounds you can now delete, with a prompt for a coding agent, and what to check.

### Added

- `reveal.css`, a stylesheet that hides reveal elements from the first paint until `init()` reaches them, only on screen, with scripting on and motion not reduced. A CSS failsafe shows content after `--data-reveal-failsafe` (5 s by default) if the script never runs. Import it as `@boccdotdev/data-reveal/reveal.css`. (#20)
- `data-reveal-state` on every element `init()` reaches: `ready`, `skipped`, `failed`, and `done` once a play-once reveal finishes. It stays after `destroy()`, so `reveal.css` doesn't hide torn-down content. More values may come later. (#3, #4, #57)
- `data-reveal-pending` on an element, or `batch` item, whose reveal isn't at its end. (#15)
- `defaults` and `typeDefaults` on `createReveal()`, read by the same rules as attributes. A few global defaults are ignored where the option means something else to a type: `start` and `end` for `parallax`; `duration`, `from` and `ease` for `counter`; `from` for `scale`; `stagger` for `split`. (#21)
- `data-reveal-ease` and an `ease` option. Each type keeps its own built-in ease otherwise, whatever `gsap.defaults()` says. (#22)
- `data-reveal-keep` and a `keep` option, to keep a finished reveal's end state inline. (#2)
- `data-reveal-aria` and an `aria` option for `split`. (#7)
- `refresh()` returns a promise that resolves once the refresh has run. (#57)
- `destroy(options)`, as well as `destroy(container, options)`, with a `revert` option. (#1, #57)
- `batch` takes on items added later: append them and call `init()` over the batch again. Only the new items reveal. (#23)
- `batch` items with no size when it arms (hidden containers, items hidden below a breakpoint, closed `<details>`, tracks a script sizes later) wait until they get one. (#9)
- Printing: pending reveals play to their end on `beforeprint`, reverse ones go back on `afterprint`, and `reveal.css` has print rules for printing without the event. (#15)
- Exported types: `RevealDestroyOptions`, `RevealDefaults`, `RevealOptions`, `RevealTypeDefaults`, `Axis`, `Direction`, `SplitType`, `SplitAria`, and `CreateRevealOptions` from both entries. `RevealInit` and `RevealContext` are documented as the 0.4 type-author contract, which 0.5 replaces. (#57)
- README sections on recipes (page transitions, htmx and Sprig, the Shopify theme editor, Astro view transitions, Lenis), gotchas, printing and committed builds, and `UPGRADING.md`. (#44, #45, #47, #48)
- A `LICENSE` file and this changelog. (#50)

### Changed

- A finished play-once reveal hands every prop it animated (`opacity`, `transform`, `translate`, `rotate`, `scale`, `transform-origin`, `clip-path`, `filter`) back to the element's CSS, so nothing is left inline. `data-reveal-reverse` and `data-reveal-keep` still keep the end state. (#2)
- Reveals end at the element's own opacity and transform, so a `.muted` element ends at its own opacity without overshooting it, and an element with a transform of its own, including Tailwind v4's `translate`, `rotate` and `scale`, stays where its CSS puts it. `rotate` turns around the element's own `transform-origin`, except on SVG, where it uses the centre. (#53, #55)
- `destroy()` puts elements back as they were before `init()`: the animated props on the element and on `batch` items, and a counter's number. `{ revert: false }` keeps the old behaviour. Each instance's `destroy()` only tears down the reveals it armed, and an element one instance armed isn't armed again by another, including one from a separately bundled copy. A first argument that is neither a node nor an options object throws a `TypeError`. (#1, #54, #57)
- `refresh()`, and the refresh `init()` schedules, run in ScrollTrigger's safe mode: about 200 ms later, once scrolling has stopped, so smooth scrolls and hash landings aren't cut short. With no triggers on the page, nothing refreshes. (#13)
- The built-in start reaches content near the end of the page, and plays straight away on a page too short to scroll. It's now a function ScrollTrigger calls on each refresh, not the string `"top 85%"`. (#5)
- `init(container)` includes the container when it's a reveal element itself. (#10)
- A type chunk that fails to load, or an init that throws, no longer stops the other types. `init()` rejects with the first error once every type has settled. Unknown or bare `data-reveal` values are marked `skipped` and shown, and a value like `valueOf` no longer breaks `init()`. Failed elements are released, so a later `init()` tries them again. (#3)
- Under a pre-hide rule of the site's own, `counter`, `parallax`, skipped and failed elements, and the `split` and `batch` containers, get `opacity: 1`. (#4)
- `split` pieces are `<span>`s with the classes `data-reveal-char`, `data-reveal-word` and `data-reveal-line`. A `lines` split splits again when a web font loads or its width changes. Chars default to readable, word-level text for assistive tech; words and lines are left as they are. A finished play-once split puts the element's own HTML back. (#6, #7)
- A finished play-once reveal lets go of its tweens, ScrollTriggers and snapshot, so long sessions don't keep every revealed element alive. Content removed before it reveals still needs `destroy(container)`. (#12, #56)
- An element that is both its own reveal and a `batch` item animates once: the first to start plays, and the other finishes with it. `batch` no longer uses GSAP's `overwrite`, which killed other tweens on its items, including a site's own. (#55)
- `sideEffects` is `["*.css"]`, and there's a new `./reveal.css` export.

### Fixed

- `destroy()` during an `init()` that's still loading types no longer gets undone: that call skips the elements you destroyed. (#11)
- `destroy()` stops every `batch` group still animating, not only the latest.
- After a reveal hands its transform back, or after `destroy()`, a site's own GSAP tween on the element starts from where the CSS puts it. (#53)
- Elements below the fold no longer print blank. (#15)
- `batch` items with no size at init no longer get stuck or reveal unseen. (#9)
- Firefox copies `split` text as text, not a piece per line.
- A reveal waiting on an element now finishes when a site stops the first reveal on it with `gsap.killTweensOf()`.

### What a 0.3.1 site will notice

With no code changes on the site:

- Every element `init()` reaches gets `data-reveal-state`, which stays after `destroy()` and becomes `done` when a play-once reveal finishes. CSS of your own that uses `:not([data-reveal-state])` or tests for `ready` will react to it.
- A failed type chunk no longer stops the other types: they run, and `init()` rejects once every type has settled, rather than at once with nothing armed. A chunk that hangs still keeps `init()` from settling, but the other types run meanwhile. Unknown, misspelt or bare `data-reveal` values are marked `skipped` and shown, and a value like `valueOf` no longer rejects `init()`.
- Under a pre-hide rule of your own, skipped and failed elements, `parallax` and counters now show, with `opacity: 1` inline. `destroy()` can leave that inline too.
- Finished play-once reveals leave no inline `opacity`, `transform`, `translate`, `rotate`, `scale`, `transform-origin`, `clip-path` or `filter`. Fixed-position children, overflow and hover classes work again; CSS that relied on the inline end state (a transform's containing block, `opacity: 1` beating a utility) changes. Opt out with `data-reveal-keep`.
- Reveals end at the element's own opacity (`.muted` ends at 0.6, not 1) and keep its own transform. `rotate` no longer forces `transform-origin: center` on HTML elements.
- `destroy()` reverts by default, and a counter shows its target. `{ revert: false }` is 0.3.1's behaviour. Each instance's `destroy()` only touches its own reveals.
- `destroy()` during a pending `init()` cancels those elements, and `reveal.css`, if you use it, keeps them hidden until the next `init()` or the failsafe.
- `init(el)` includes `el` itself.
- The built-in start reaches content near the end of the page. Code that reads `trigger.vars.start` as a string gets a function.
- `refresh()`, and the refresh after `init()`, land about 200 ms after scrolling stops rather than on the next frame, and don't run when there are no triggers. `refresh()` returns a promise.
- Under reduced motion, play-once elements are `done` straight away, and nothing is set inline beyond `opacity: 1` under a site pre-hide and a counter's text.
- `split` pieces are `<span>`s with classes, not `<div>`s. No split puts SplitText's `aria-label` on the element any more. In a `chars` split, each word's pieces are hidden from assistive tech, with a visually hidden copy of the word in front of them (`data-reveal-aria`).
- Printing, or anything that fires `beforeprint`, plays every pending play-once reveal to its end, and it stays finished on screen afterwards.
- `init()` over a `batch` animates items appended since, and hides items appended in view that have already painted, so they replay. Call it before paint.
- A `batch` no longer kills a site's own tweens on its items.
- Elements carry `data-reveal-pending` until their reveal finishes.
- Packaging: `sideEffects` is `["*.css"]`, with a new `./reveal.css` export. `RevealContext.defaults` is a new optional field, `destroy()` takes options, and more types are exported.
- Size: the manual entry with `fade` alone is about 5.0 KB minified and gzipped, up from about 1.2 KB, without GSAP.

Not fixed yet: `counter` drops text around the number (#14).
