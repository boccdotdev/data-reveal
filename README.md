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

- Only on screen, while JavaScript is on and the visitor hasn't asked for reduced motion. Printing never hides anything. Browsers without the `scripting` media feature (Safari before 17, Chrome before 120, Firefox before 113) skip the rule, so their visitors can see the flash but never a blank page.
- Only until `init()` handles the element. `init()` sets `data-reveal-state` on every element it reaches: `ready` when its type took over, `skipped` when no type is registered under that name, and `failed` when the type's module didn't load or its init threw. The stylesheet lets go in all three cases.
- If your script never runs, a CSS failsafe shows the content after 5 seconds. Change the delay with a custom property. The value needs a time unit, like `3s` or `3000ms`. Anything else, `0` included, shows the content straight away.

```css
:root { --data-reveal-failsafe: 3s; }
```

`parallax` is never hidden, because it has no hidden starting state.

Import the stylesheet from CSS that loads in `<head>`. Imported from JavaScript, it can arrive too late to stop the flash.

The failsafe is a CSS animation on each waiting element, so it competes with any `animation` rule of your own that matches the same element. If yours wins the cascade, the failsafe never runs and the element stays hidden on a page whose script fails. If the failsafe wins, your animation waits until `init()` reaches the element.

`destroy()` leaves `data-reveal-state` in place on purpose, so the stylesheet doesn't hide content you've torn down.

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

If you keep an older rule that hides every `[data-reveal]`, each type still shows its element once it runs. `counter`, `parallax`, `clip` and the `split` and `batch` containers don't animate their own opacity, so they set it to 1 only if it computes to 0 when they start, and otherwise keep the opacity your CSS gives them. Skipped and failed elements stay hidden under a rule like that.

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

reveal.destroy();                 // kill everything, revert SplitText, forget all elements
reveal.destroy(myContainer);      // kill + forget only reveals on/inside myContainer
```

`init()` is idempotent — already-initialized elements are skipped, so you can safely call it again as new content is added (e.g. infinite scroll).

If a type's module fails to load, or its init throws on an element, `init()` still runs every other type, marks the affected elements `data-reveal-state="failed"`, and rejects with the first error once every type has settled. A failed element shows without its animation if your pre-hide CSS is keyed on the state, as `reveal.css` is. Anything the type set up on it before throwing is undone.

Failed elements are also released, so a later `init()` tries them again. Whether that works depends on the loader. A browser keeps a failed native `import()` for the life of the page, so in auto mode without a bundler the retry fails the same way until a reload. Loaders that fetch again, such as webpack's, can recover, and a type whose init threw simply runs again.

If an earlier `init()` call is still loading some of the elements a new call covers, the new call waits for them, so by the time it resolves every element it covers has been handled.

### `refresh()`

Recomputes every ScrollTrigger's start/end positions. ScrollTrigger already refreshes on window resize and load, but a **JavaScript-driven layout change doesn't fire that** — so call `refresh()` after toggling a grid's column count, opening an accordion, or when fonts/images finish loading and shift the page. Calls are coalesced to one refresh per frame, so it's cheap to call repeatedly.

### `destroy(container?)`

With no argument, kills all tweens + ScrollTriggers, reverts SplitText, and forgets every element — a later `init()` re-runs the whole page. Pass a `container` to tear down only the reveals on or inside it; those elements are forgotten too, so re-adding content there and calling `init()` re-animates just that subtree. `contains` works on detached nodes, so you can pass a subtree you're about to remove. Use the scoped form for SPA partial swaps, the bare form for a full route change.

`destroy()` also covers an `init()` that is still loading types. That call skips the elements you destroyed, so `init(); destroy(); init()` arms each element once. An element removed from the page while its type loads isn't armed either, and a later `init()` picks it up if it comes back.

## Animation types

All types accept these shared attributes:

| Attribute | Default | Notes |
|-----------|---------|-------|
| `data-reveal-duration` | varies | Seconds |
| `data-reveal-delay` | `0` | Seconds |
| `data-reveal-start` | `top 85%` | ScrollTrigger `start` position |
| `data-reveal-reverse` | off | Add it to play the animation out again when scrolling back up past `start`. Default is play-once. (`parallax` is always bidirectional and ignores this.) |

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
| `data-reveal-from` | `0.92` | Starting scale |

### `split`
Per-character/word/line text reveal (uses SplitText).

| Attribute | Default | Values |
|-----------|---------|--------|
| `data-reveal-split` | `chars` | `chars` `words` `lines` |
| `data-reveal-stagger` | `0.02` | Seconds between units |

### `batch`
Staggered reveal of many children as they enter together. Targets elements marked `data-reveal-item`, or falls back to direct children.

| Attribute | Default | Notes |
|-----------|---------|-------|
| `data-reveal-stagger` | `0.06` | Seconds |
| `data-reveal-distance` | `20` | px |

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
Continuous, scroll-linked motion (scrubbed — not a one-shot reveal). Disabled under reduced motion.

| Attribute | Default | Notes |
|-----------|---------|-------|
| `data-reveal-speed` | `0.3` | Higher = more movement |
| `data-reveal-start` | `top bottom` | ScrollTrigger `start` |
| `data-reveal-end` | `bottom top` | ScrollTrigger `end` |

## License

MIT
