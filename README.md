# @boccdotdev/data-reveal

Declarative, scroll-triggered reveal animations driven by HTML `data-` attributes. Powered by [GSAP](https://gsap.com) + ScrollTrigger.

- **Code-split** — each animation type loads on demand. A page that only uses `fade` never downloads the `split` code (or its SplitText plugin).
- **Zero side effects on import** — nothing runs, and no GSAP is loaded, until you call `init()`.
- **Respects `prefers-reduced-motion`** — elements snap to their final state instead of animating.

## Install

```bash
npm install @boccdotdev/data-reveal gsap
```

`gsap` is a **peer dependency** (`>=3.13.0`) — you install it yourself so the package shares your single GSAP instance. GSAP 3.13+ ships ScrollTrigger and SplitText for free; no Club membership required.

## Quick start

```ts
import { createReveal } from "@boccdotdev/data-reveal";

const reveal = createReveal();
await reveal.init();          // scan the document, load only the types in use
```

```html
<h2 data-reveal="split" data-reveal-split="words">Animated headline</h2>
<div data-reveal="fade" data-reveal-direction="left">Fades in from the left</div>
<span data-reveal="counter" data-reveal-to="1200" data-reveal-separator=",">0</span>
```

That's it. Add a `data-reveal` attribute to any element and it animates as it scrolls into view.

## How loading works

`init()` scans the container for `[data-reveal]`, collects the set of types present, then dynamically `import()`s **only those** modules. Your bundler (Vite, webpack, etc.) splits each type into its own chunk, so the browser fetches code for an animation only when a page actually uses it. GSAP itself rides along in those chunks — a page with no reveals loads no GSAP.

Because loading is dynamic, `init()` is **async**. `await` it (or `.then()`) if you need to run code after reveals are set up.

Each type starts as soon as its own module arrives, so a slow `split` chunk doesn't hold back `fade`. The promise settles once every type has. If one type's chunk never finishes loading, the other types still run but `init()` doesn't settle.

## Hiding elements until they load

A reveal hides its element when `init()` reaches it, which is after your script and the type's chunk have loaded. Until then the content is visible, so it can flash in and out before animating. Import the shipped stylesheet in your main CSS to hide reveal elements from the first paint:

```css
@import "@boccdotdev/data-reveal/reveal.css";
```

The file sits at the package root, so `postcss-import` (as in Tailwind v3 setups) finds it as well as bundlers that read `exports`.

It only hides content while that's safe:

- Only on screen, while JavaScript is on and the visitor hasn't asked for reduced motion. The stylesheet never hides anything in print, though an element a type has already set to its hidden starting state, such as a fade below the fold, still prints blank for now. Browsers without the `scripting` media feature (Safari before 17, Chrome before 120, Firefox before 113) skip the rule, so their visitors can see the flash but never a blank page.
- Only until `init()` handles the element. `init()` sets `data-reveal-state` on every element it reaches: `ready` when its type took over, `skipped` when no type is registered under that name, and `failed` when the type's module didn't load or its init threw. The stylesheet lets go in all three cases.
- If your script never runs, a CSS failsafe shows the content after 5 seconds. Change the delay with a custom property. The value needs a time unit, like `3s` or `3000ms`. Anything else, `0` included, shows the content straight away.

```css
:root { --data-reveal-failsafe: 3s; }
```

`parallax` is never hidden, because it has no hidden starting state.

Import the stylesheet from CSS that loads in `<head>`. Imported from JavaScript, it can arrive too late to stop the flash.

The failsafe is a CSS animation on each waiting element, so it competes with any `animation` rule of your own that matches the same element. If yours wins the cascade, the failsafe never runs and the element stays hidden on a page whose script fails. If the failsafe wins, your animation waits until `init()` reaches the element.

`destroy()` leaves `data-reveal-state` in place on purpose, so the stylesheet doesn't hide content you've torn down. An element destroyed while its type was still loading never got a state, so the stylesheet keeps hiding it until `init()` reaches it again or the failsafe fires.

### Writing your own rule

Copy `reveal.css` rather than writing a shorter rule. Keep all three parts: the media query, the `:not([data-reveal-state])` and the failsafe. A bare `[data-reveal] { opacity: 0 }` leaves the page blank whenever the script doesn't run.

```css
@media screen and (scripting: enabled) and (prefers-reduced-motion: no-preference) {
  [data-reveal]:not([data-reveal="parallax"], [data-reveal-state]) {
    opacity: 0;
    animation: data-reveal-failsafe 0s 5s forwards;
    animation-delay: var(--data-reveal-failsafe, 5s);
  }
}

@keyframes data-reveal-failsafe {
  to { opacity: 1; }
}
```

If you keep an older rule that hides every `[data-reveal]`, every element still ends up visible once `init()` reaches it. Types that animate opacity end at 1. `counter`, `parallax`, `clip` and the `split` and `batch` containers don't animate their own opacity, and skipped and failed elements aren't animated at all. For those, `init()` sets the opacity to 1 only if it would otherwise settle at 0, so an opacity your CSS sets on purpose stays.

## Minimal builds (manual registration)

Auto mode is convenient, but to dynamically load any type on demand it has to *reference* every type — so your bundler emits a chunk file for all of them, even ones your site never uses. They're never downloaded unless present on a page, but the files still sit in your build output.

If you want only the types you use to exist in your build at all, import the **`/manual`** entry and register types explicitly. It has no reference to the auto-loader, so unused type modules (and their GSAP plugins) are never bundled:

```ts
import { createReveal } from "@boccdotdev/data-reveal/manual";
import { fade } from "@boccdotdev/data-reveal/fade";
import { scale } from "@boccdotdev/data-reveal/scale";

const reveal = createReveal({ types: [fade, scale] });
await reveal.init();
```

Each type is importable from its own subpath: `@boccdotdev/data-reveal/{fade,scale,split,batch,blur,clip,rotate,slide,counter,parallax}`. The HTML API is identical — `data-reveal="fade"` still works; you've just told the bundler which types are in play. A `data-reveal` type you didn't register is skipped without an error and gets `data-reveal-state="skipped"`, unless another instance has already set a state on it.

The returned instance is the same as auto mode — `init`, `refresh`, `destroy` all behave identically. Choose auto for zero-config convenience, manual when build size matters.

## API

```ts
const reveal = createReveal();

await reveal.init();              // scan document
await reveal.init(myContainer);   // scan a subtree only (any ParentNode), including myContainer itself

reveal.refresh();                 // recompute all ScrollTrigger positions

reveal.destroy();                 // kill everything, put elements back, forget them
reveal.destroy(myContainer);      // the same, only for reveals on/inside myContainer
reveal.destroy(myContainer, { revert: false }); // leave the reveals' inline styles in place
```

`init()` is idempotent — already-initialized elements are skipped, so you can safely call it again as new content is added (e.g. infinite scroll).

If a type's module fails to load, or its init throws on an element, `init()` still runs every other type, marks the affected elements `data-reveal-state="failed"`, and rejects with the first error once every type has settled. A failed element shows without its animation. When a type's init throws, the tweens, ScrollTriggers and SplitText it had registered on that element are killed, and the element's `style` attribute goes back to what it was. Inline styles on its children, and anything the type didn't register, stay as they are.

Failed elements are also released, so a later `init()` tries them again. Whether that works depends on the loader. Browsers keep a failed native `import()` for the life of the page, and Vite, Rollup and esbuild output all load chunks with native `import()`, so there the retry fails the same way until a reload. Loaders that fetch again, such as webpack's, can recover, and a type whose init threw simply runs again.

Each call waits only for the elements it claims. If an earlier call is still loading some of the same elements, they stay with that call: the new call doesn't arm them again and doesn't wait for them, so one stuck chunk can't hold up later calls. Await the earlier call too if you need those elements armed.

### `refresh()`

Recomputes every ScrollTrigger's start/end positions. ScrollTrigger already refreshes on window resize and load, but a **JavaScript-driven layout change doesn't fire that** — so call `refresh()` after toggling a grid's column count, opening an accordion, or when fonts/images finish loading and shift the page. Calls are coalesced to one refresh per frame, so it's cheap to call repeatedly.

The refresh after `refresh()`, and the one `init()` schedules once something new is armed, run in ScrollTrigger's safe mode: about 200 ms later, and only once the page has stopped scrolling. A smooth scroll in progress (`scroll-behavior: smooth`, a scroll-to tween, Lenis) or a landing on a `#hash` link carries on undisturbed. That also means `refresh()` returns before the positions have changed. If you need them recomputed at once, call `ScrollTrigger.refresh()` yourself.

### `destroy(container?, options?)`

With no argument, kills all tweens + ScrollTriggers, reverts SplitText, and forgets every element — a later `init()` re-runs the whole page. Pass a `container` to tear down only the reveals on or inside it; those elements are forgotten too, so re-adding content there and calling `init()` re-animates just that subtree. `contains` works on detached nodes, so you can pass a subtree you're about to remove. Use the scoped form for SPA partial swaps, the bare form for a full route change.

By default `destroy()` puts every element it tears down back as it was before `init()`. The props reveals animate (`opacity`, `transform`, `clip-path`, `filter`) go back to their values from before `init()`, on the element and on children the type changed (`batch` items). Any other inline style, such as one your own code set since, stays. An element that hadn't revealed yet shows as written instead of staying hidden in its starting state, and a counter shows the number it counts to, whether or not it got there. Each element keeps `data-reveal-state`, so `reveal.css` doesn't hide it again, and if a pre-hide rule of your own would, it gets `opacity: 1`.

Pass `{ revert: false }` to leave the reveals' inline styles where they are, for example when you're about to remove or replace the elements anyway. Calling `init()` on such an element later reads whatever is still inline as the element's own style, so an element that hadn't revealed yet starts from its old starting state as if that were its resting place. Use the default if you plan to `init()` it again.

`destroy()` also covers an `init()` that is still loading types. That call skips the elements you destroyed, so `init(); destroy(); init()` arms each element once. An element removed from the page while its type loads isn't armed either, and a later `init()` picks it up if it comes back. A subtree that was never on the page, such as a card you call `init(card)` on just before inserting it, is armed as usual.

## Defaults

Set house values once instead of repeating attributes on every element. Both entries take the same options:

```ts
createReveal({
  defaults: { duration: 0.35, start: "top 75%", ease: "power3.out" },
  typeDefaults: {
    batch: { distance: 40, stagger: 0.08, start: "top 88%" },
    scale: { from: 0.8 },
  },
});

// Manual mode
createReveal({ types: [fade, batch], defaults: { duration: 0.35 } });
```

Each option is named after its attribute without the `data-reveal-` prefix, so `data-reveal-duration` is `duration`, and takes the same values. For each option, a reveal uses the first of:

1. the attribute on the element
2. `typeDefaults` for its type
3. `defaults`
4. the type's built-in value

A global default applies to every type that reads the option, except where the option means something else to the type:

- `parallax` ignores a global `start` and `end`, which would shrink its scroll range.
- `counter` ignores a global `duration`, which would rush the count, a global `ease`, which could overshoot the target (1,262 on the way to 1,200), and a global `from`.
- `scale` ignores a global `from`, which is a starting number for `counter`, not a scale.
- `split` ignores a global `stagger`, which is per character there.

These still apply when set in `typeDefaults` or as an attribute.

| Option | Read by |
|--------|---------|
| `duration` | every type but `parallax` (`counter` ignores a global one) |
| `keep` | `fade`, `scale`, `blur`, `clip`, `rotate`, `slide`, `batch`, `split` |
| `delay` | `fade`, `scale`, `split`, `blur`, `clip`, `rotate`, `slide` |
| `start` | every type (`parallax` ignores a global one) |
| `end` | `parallax` (ignores a global one) |
| `ease` | every type but `parallax` (`counter` ignores a global one) |
| `reverse` | every type but `parallax` |
| `distance` | `fade`, `batch` |
| `stagger` | `split` (ignores a global one), `batch` |
| `direction` | `fade`, `clip`, `slide` |
| `from` | `scale` (starting scale), `counter` (starting number), both ignoring a global one |
| `to`, `decimals`, `separator`, `prefix`, `suffix` | `counter` |
| `blur` | `blur` |
| `axis`, `rotate` | `rotate` |
| `split`, `aria` | `split` |
| `speed` | `parallax` |

Values in `defaults` and `typeDefaults` are read the same way as attributes, so `"0.5"` works for a duration, `"false"` turns `reverse` off, and an empty `start` counts as unset.

Both entries export the option types: `CreateRevealOptions`, `RevealOptions` and `RevealTypeDefaults`.

## Animation types

All types accept these shared attributes:

| Attribute | Default | Notes |
|-----------|---------|-------|
| `data-reveal-duration` | varies | Seconds |
| `data-reveal-delay` | `0` | Seconds |
| `data-reveal-start` | `top 85%` | ScrollTrigger `start` position. See below for content near the end of the page. |
| `data-reveal-ease` | varies | Any GSAP ease, e.g. `power2.out`. Each type has its own built-in ease. (`parallax` is scrubbed and ignores this.) |
| `data-reveal-reverse` | off | Add it to play the animation out again when scrolling back up past `start`. Default is play-once. (`parallax` is always bidirectional and ignores this.) |
| `data-reveal-keep` | off | Add it to keep the end state inline once the reveal finishes. See below. |

An element near the end of the page, such as one in the footer, may never scroll as far up as `top 85%`. With the built-in start it still plays: once the page is scrolled to the bottom, or straight away on a page too short to scroll. The start is measured against the element's scroller, so this holds inside a scrolling container set with `ScrollTrigger.defaults({ scroller })` too. A start you set yourself is used exactly as given. To get the same for it, wrap it in `clamp()` too, as in `data-reveal-start="clamp(top 75%)"`. Keep that to content below the fold: `clamp()` also holds back content that's in view when the page loads until the first scroll.

Without an ease of your own, each type keeps the one it has always had, whatever `gsap.defaults()` says. Eases go by name. For a custom one, register it first, as in `CustomEase.create("house", "0.2, 0, 0, 1")`, then set `ease: "house"` or `data-reveal-ease="house"`. A function in `defaults` isn't used.

### After a reveal

When a play-once reveal finishes, it leaves nothing inline. The props it animated (`opacity`, `transform`, `clip-path`, `filter`) go back to the element's own CSS without a jump, because each reveal ends where that CSS puts the element:

- at its own opacity, so a `.muted { opacity: 0.6 }` element ends at 0.6;
- at its own transform, including the `translate`, `rotate` and `scale` properties that Tailwind v4's utilities set. `fade`, `slide`, `scale`, `rotate` and `batch` items start from that transform plus their own offset, so an element centred with `translateX(-50%)` stays centred while it slides in, and `scale`'s `from` is relative to the element's own scale.

Before 0.4 the end state stayed inline, which got in the way:

- Any transform, even `translate(0, 0)`, makes the element the containing block for `position: fixed` descendants, so a fixed overlay inside it scrolled with it.
- `clip-path: inset(0)` cut off anything that overflowed the box, such as shadows, badges and dropdowns.
- Inline `opacity: 1` beat classes, such as a hover dim.

Two cases keep the end state inline. `data-reveal-reverse` needs it to play backwards, and `data-reveal-keep` (or `keep` in the defaults) asks for it. Under reduced motion nothing is set inline in the first place. If a pre-hide rule of your own hides `[data-reveal]` outright, a finished reveal keeps `opacity: 1` inline so it stays visible. A finished `split` goes further and puts the element's own HTML back (see below).

### `fade`
Fade + translate in.

| Attribute | Default | Values |
|-----------|---------|--------|
| `data-reveal-direction` | `up` | `up` `down` `left` `right` |
| `data-reveal-distance` | `20` | px |

### `scale`
Fade + scale up.

| Attribute | Default | Notes |
|-----------|---------|-------|
| `data-reveal-from` | `0.92` | Starting scale, relative to the element's own |

### `split`
Per-character/word/line text reveal (uses SplitText).

| Attribute | Default | Values |
|-----------|---------|--------|
| `data-reveal-split` | `chars` | `chars` `words` `lines` |
| `data-reveal-stagger` | `0.02` | Seconds between units |
| `data-reveal-aria` | see below | `hidden` `none` `auto` |

Lines are measured when the text is split, so `split` splits again, and rebuilds its animation, when a web font finishes loading or the element's width changes. That includes an element you `init()` before it's in the page, which gets its real width once you insert it. Words and characters don't depend on layout, so they're split once.

When a play-once split finishes, it puts the element's own HTML back: the original text for assistive tech and copy and paste, and nothing left to split again. With `data-reveal-reverse` or `data-reveal-keep` the split stays, and a `lines` split keeps re-splitting.

How the text reaches screen readers depends on what it's split into:

- **`chars`** (`hidden` by default). One element per character is read letter by letter by some screen readers, so each word's pieces are hidden from assistive tech, with a visually hidden copy of the word in front of them. The element keeps its own role, and links keep their name and stay out of hidden content.
- **`words` and `lines`** (`none` by default). The real words stay in the page and are read as they are.
- **`auto`** is SplitText's own default: an `aria-label` on the element. That isn't allowed on a plain `<p>`, `<span>` or `<div>`, where screen readers then read nothing, so only choose it on a heading or an element with a role that can be named.

Set `data-reveal-aria`, or `aria` in `typeDefaults.split`, to change it.

With `hidden`, the copies are in the page for as long as the element is split: until its reveal finishes, and for good with `data-reveal-reverse` or `data-reveal-keep`. They can't be selected, so copy and paste gets each word once. The element's `textContent` has every word twice, though, and the browser's find in page can match a word's copy as well as the word.

Splitting collapses white space, so line breaks that come from `white-space: pre-line` disappear while the element is split. Use `<br>` for line breaks in split text. Reduced motion doesn't split at all.

### `batch`
Staggered reveal of many children as they enter together. Targets elements marked `data-reveal-item`, or falls back to direct children.

| Attribute | Default | Notes |
|-----------|---------|-------|
| `data-reveal-stagger` | `0.06` | Seconds |
| `data-reveal-distance` | `20` | px |

With `data-reveal-reverse`, items ease out with `power2.in`. An ease you set applies both ways.

```html
<ul data-reveal="batch">
  <li data-reveal-item>One</li>
  <li data-reveal-item>Two</li>
</ul>
```

### `blur`
Fade in from a blur.

| Attribute | Default | Notes |
|-----------|---------|-------|
| `data-reveal-blur` | `12` | Starting blur in px |

### `clip`
`clip-path` wipe reveal.

| Attribute | Default | Values |
|-----------|---------|--------|
| `data-reveal-direction` | `up` | `up` `down` `left` `right` (wipe direction) |

### `rotate`
3D rotate in.

| Attribute | Default | Values |
|-----------|---------|--------|
| `data-reveal-axis` | `x` | `x` `y` `z` |
| `data-reveal-rotate` | `90` | Degrees |

### `slide`
Slide in from fully off the element's own box.

| Attribute | Default | Values |
|-----------|---------|--------|
| `data-reveal-direction` | `up` | `up` `down` `left` `right` |

### `counter`
Count a number up as it enters view. Reads the target from `data-reveal-to`, or the element's text content.

| Attribute | Default | Notes |
|-----------|---------|-------|
| `data-reveal-to` | element text | Target number |
| `data-reveal-from` | `0` | Starting number |
| `data-reveal-decimals` | `0` | Decimal places |
| `data-reveal-separator` | — | Thousands separator, e.g. `,` |
| `data-reveal-prefix` | — | e.g. `$` |
| `data-reveal-suffix` | — | e.g. `%` |

### `parallax`
Continuous, scroll-linked motion (scrubbed — not a one-shot reveal). Disabled under reduced motion. It moves in step with the scroll, so it ignores `data-reveal-ease`, and its start isn't clamped.

| Attribute | Default | Notes |
|-----------|---------|-------|
| `data-reveal-speed` | `0.3` | Higher = more movement |
| `data-reveal-start` | `top bottom` | ScrollTrigger `start` |
| `data-reveal-end` | `bottom top` | ScrollTrigger `end` |

## Development

```bash
npm install
npx playwright install   # browsers for the end-to-end tests, once
npm run typecheck        # the library, then the tests and configs
npm test                 # unit tests: Vitest with happy-dom
npm run test:e2e         # build, then Playwright in Chromium, Firefox and WebKit
npm run test:all         # both
```

The unit tests in `tests/unit` cover the core and the registry with stand-in types. The end-to-end tests in `tests/e2e` load fixture pages from a small local server that can fail, delay or hold back any file, to act out a broken deploy or a slow network. GSAP comes from `node_modules`, so the tests don't need the internet. To run one browser, use `npx playwright test --project=chromium`. The fixture server listens on port 4791. Set `E2E_PORT` to run a second checkout's tests at the same time.

## License

MIT
