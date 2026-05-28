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

## API

```ts
const reveal = createReveal();

await reveal.init();              // scan document
await reveal.init(myContainer);   // scan a subtree only (any ParentNode)

reveal.refresh();                 // recompute all ScrollTrigger positions

reveal.destroy();                 // kill everything, revert SplitText, forget all elements
reveal.destroy(myContainer);      // kill + forget only reveals on/inside myContainer
```

`init()` is idempotent — already-initialized elements are skipped, so you can safely call it again as new content is added (e.g. infinite scroll).

### `refresh()`

Recomputes every ScrollTrigger's start/end positions. ScrollTrigger already refreshes on window resize and load, but a **JavaScript-driven layout change doesn't fire that** — so call `refresh()` after toggling a grid's column count, opening an accordion, or when fonts/images finish loading and shift the page. Calls are coalesced to one refresh per frame, so it's cheap to call repeatedly.

### `destroy(container?)`

With no argument, kills all tweens + ScrollTriggers, reverts SplitText, and forgets every element — a later `init()` re-runs the whole page. Pass a `container` to tear down only the reveals on or inside it; those elements are forgotten too, so re-adding content there and calling `init()` re-animates just that subtree. `contains` works on detached nodes, so you can pass a subtree you're about to remove. Use the scoped form for SPA partial swaps, the bare form for a full route change.

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
