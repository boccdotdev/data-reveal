# @boccdotdev/data-reveal

Declarative, scroll-triggered reveal animations driven by HTML `data-` attributes. Powered by [GSAP](https://gsap.com) and ScrollTrigger.

- **Code-split.** Each animation type loads on demand. A page that only uses `fade` never downloads the `split` code or its SplitText plugin.
- **Nothing runs until `init()`.** With the default entry, no GSAP loads until then either. In [manual mode](#minimal-builds-manual-registration), importing a type's subpath imports GSAP and registers its plugins.
- **Respects `prefers-reduced-motion`.** Elements show at their final state instead of animating.

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [How loading works](#how-loading-works)
- [Hiding elements until they load](#hiding-elements-until-they-load)
- [Minimal builds (manual registration)](#minimal-builds-manual-registration)
- [API](#api): [`init()`](#init), [`refresh()`](#refresh), [`destroy()`](#destroycontainer-options), [`data-reveal-state`](#data-reveal-state)
- [Defaults](#defaults)
- [Animation types](#animation-types): [shared attributes](#shared-attributes), [after a reveal](#after-a-reveal), [`fade`](#fade), [`scale`](#scale), [`split`](#split), [`batch`](#batch), [`blur`](#blur), [`clip`](#clip), [`rotate`](#rotate), [`slide`](#slide), [`counter`](#counter), [`parallax`](#parallax)
- [Printing](#printing)
- [Recipes](#recipes): [page transitions](#page-transitions-taxi-barba-swup), [htmx and Sprig](#htmx-and-sprig), [Shopify theme editor](#shopify-theme-editor), [Astro view transitions](#astro-view-transitions), [Lenis](#lenis)
- [Gotchas](#gotchas)
- [Upgrading from 0.3](#upgrading-from-03)
- [Development](#development)
- [License](#license)

## Install

Install `gsap` alongside the package. **The package doesn't bring GSAP with it**: `gsap` is a peer dependency, so your project needs its own copy.

```bash
npm install @boccdotdev/data-reveal gsap
```

That way the package shares your single GSAP instance and registers its plugins on it. It needs `gsap` 3.13 or later, which ships ScrollTrigger and SplitText for free, with no Club membership.

If the build fails with something like "Could not resolve `gsap`" or "Failed to resolve import `gsap/ScrollTrigger`", `gsap` isn't in your `package.json`. Some package managers, such as Yarn 1, only warn about a missing peer, so a project can build by accident until a clean install drops it. Add it with `npm install gsap` (or your package manager's equivalent).

## Quick start

```ts
import { createReveal } from "@boccdotdev/data-reveal";

const reveal = createReveal();
await reveal.init(); // scan the document, load only the types in use
```

```html
<h2 data-reveal="split" data-reveal-split="words">Animated headline</h2>
<div data-reveal="fade" data-reveal-direction="left">Fades in, moving left</div>
<span data-reveal="counter" data-reveal-to="1200" data-reveal-separator=",">0</span>
```

Add a `data-reveal` attribute to an element and it animates as it scrolls into view. Add the [stylesheet](#hiding-elements-until-they-load) too, so elements don't flash before their reveal is ready.

## How loading works

`init()` scans the container for `[data-reveal]`, collects the types present, then dynamically `import()`s **only those** modules. Your bundler (Vite, webpack and so on) splits each type into its own chunk, so the browser fetches the code for an animation only when a page uses it. GSAP rides along in those chunks, so a page with no reveals loads no GSAP.

Because loading is dynamic, `init()` is **async**. `await` it if you need to run code after the reveals are set up.

Each type starts as soon as its own module arrives, so a slow `split` chunk doesn't hold back `fade`. The promise settles once every type has. If one type's chunk never finishes loading, the other types still run, but `init()` doesn't settle.

## Hiding elements until they load

A reveal hides its element when `init()` reaches it, which is after your script and the type's chunk have loaded. Until then the content is visible, so it can flash before animating. Import the shipped stylesheet in your main CSS to hide reveal elements from the first paint:

```css
@import "@boccdotdev/data-reveal/reveal.css";
```

Import it from CSS that loads in `<head>`. Imported from JavaScript, it can arrive too late to stop the flash. The file sits at the package root, so `postcss-import` (as in Tailwind v3 setups) finds it as well as bundlers that read `exports`.

It only hides content while that's safe:

- Only on screen, while JavaScript is on and the visitor hasn't asked for reduced motion. It never hides anything in print. Browsers without the `scripting` media feature (Safari before 17, Chrome before 120, Firefox before 113) skip the rule, so their visitors can see the flash but never a blank page.
- Only until `init()` reaches the element. `init()` sets [`data-reveal-state`](#data-reveal-state) on every element it reaches, whatever happens to it, and the stylesheet lets go as soon as the attribute is there.
- If your script never runs, a CSS failsafe shows the content after 5 seconds. Change the delay with a custom property. The value needs a time unit, like `3s` or `3000ms`. Anything else, `0` included, shows the content straight away.

```css
:root { --data-reveal-failsafe: 3s; }
```

`parallax` is never hidden, because it has no hidden starting state. The stylesheet also has [print rules](#printing).

The failsafe is a CSS animation on each waiting element, so it competes with any `animation` rule of your own that matches the same element. If yours wins the cascade, the failsafe never runs and the element stays hidden on a page whose script fails. If the failsafe wins, your animation waits until `init()` reaches the element.

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

If you keep an older rule that hides every `[data-reveal]`, every element still ends up visible once `init()` reaches it. Types that animate opacity end at the element's own. `counter`, `parallax`, `clip` and the `split` and `batch` containers don't animate their own opacity, and skipped and failed elements aren't animated at all. For those, `init()` sets the opacity to 1 only if it would otherwise settle at 0, so an opacity your CSS sets on purpose stays.

## Minimal builds (manual registration)

To load any type on demand, the default entry has to *reference* every type, so your bundler emits a chunk file for all ten, even ones your site never uses. They're never downloaded unless a page uses them, but the files still sit in your build output.

If you want only the types you use to exist in your build, import the **`/manual`** entry and register types yourself. It has no reference to the other types, so their modules (and their GSAP plugins) are never bundled:

```ts
import { createReveal } from "@boccdotdev/data-reveal/manual";
import { fade } from "@boccdotdev/data-reveal/fade";
import { scale } from "@boccdotdev/data-reveal/scale";

const reveal = createReveal({ types: [fade, scale] });
await reveal.init();
```

**Use `/manual` when your build output is committed**, as with a Shopify theme's `assets/` folder. With the default entry, every type's chunk lands in the repo, and their hashed names change on each build.

Each type has its own subpath: `@boccdotdev/data-reveal/{fade,scale,split,batch,blur,clip,rotate,slide,counter,parallax}`. The HTML is the same. A `data-reveal` type you didn't register is skipped without an error and gets `data-reveal-state="skipped"`, unless another instance has already set a state on it. The instance works the same as in auto mode.

The manual entry also exports `RevealRegistration`, and both entries export `RevealInit` and `RevealContext`, which describe a type's `init(el, ctx)`. They're how a type is written in 0.4 only. 0.5 replaces them with a contract for animation engines.

## API

```ts
const reveal = createReveal();

await reveal.init();             // scan the document
await reveal.init(myContainer);  // scan a subtree only (any ParentNode), including myContainer itself

await reveal.refresh();          // recompute every ScrollTrigger's positions

reveal.destroy();                // tear down this instance's reveals, put elements back, forget them
reveal.destroy(myContainer);     // the same, for reveals on or inside myContainer
reveal.destroy({ revert: false });              // leave the reveals' inline styles in place
reveal.destroy(myContainer, { revert: false });
```

### `init()`

`init()` is idempotent: elements it has already handled are skipped, so you can call it again as content is added (infinite scroll, say). Over a [`batch`](#batch) it has armed, it picks up the batch's new items.

If a type's module fails to load, or its init throws on an element, `init()` still runs every other type, marks the affected elements `data-reveal-state="failed"`, and rejects with the first error once every type has settled. A failed element shows without its animation. When a type's init throws, the tweens, ScrollTriggers and SplitText it had registered on that element are killed, and the element's `style` attribute goes back to what it was. Inline styles on its children, and anything the type didn't register, stay as they are.

Failed elements are also released, so a later `init()` tries them again. Whether that works depends on the loader. Browsers keep a failed native `import()` for the life of the page, and Vite, Rollup and esbuild output load chunks with native `import()`, so there the retry fails the same way until a reload. Loaders that fetch again, such as webpack's, can recover, and a type whose init threw simply runs again.

Each call waits only for the elements it claims. If an earlier call is still loading some of the same elements, they stay with that call: the new call doesn't arm them again and doesn't wait for them, so one stuck chunk can't hold up later calls. Await the earlier call too if you need those elements armed.

### `refresh()`

Recomputes the start and end positions of every ScrollTrigger on the page, not only the reveals'. ScrollTrigger already refreshes on window resize and load, but **a layout change made in JavaScript doesn't trigger that**. Call `refresh()` after toggling a grid's column count, opening an accordion, or when fonts or images finish loading and shift the page. Calls in the same frame are coalesced into one refresh, so it's cheap to call repeatedly.

The refresh, and the one `init()` schedules once something new is armed, runs in ScrollTrigger's safe mode: about 200 ms later, and only once the page has stopped scrolling. A smooth scroll in progress (`scroll-behavior: smooth`, a scroll-to tween, Lenis) or a landing on a `#hash` link carries on undisturbed.

`refresh()` returns a promise that resolves once the refresh has run, so `await reveal.refresh()` before you measure anything that depends on the new positions. Calls in the same frame share one promise. With no reveals on the page there's nothing to refresh, and it resolves straight away. While the tab is hidden the browser runs no animation frames, so the promise waits until the tab is visible again. If you need the positions recomputed at once, call `ScrollTrigger.refresh()` yourself.

### `destroy(container?, options?)`

With no argument, kills this instance's tweens and ScrollTriggers, reverts its SplitText, and forgets every element, so a later `init()` re-runs the whole page. Pass a `container` to tear down only the reveals on or inside it. Those elements are forgotten too, so re-adding content there and calling `init()` re-animates just that subtree. It works on detached nodes, so you can pass a subtree you're about to remove, or one you've just removed. Use the scoped form for partial swaps and the bare form for a full route change.

By default `destroy()` puts every element it tears down back as it was before `init()`. The props reveals animate (`opacity`, `transform`, `translate`, `rotate`, `scale`, `transform-origin`, `clip-path`, `filter`) go back to their values from before `init()`, on the element and on children the type changed (`batch` items). Any other inline style, such as one your own code set since, stays. An element that hadn't revealed yet shows as written instead of staying hidden, and a counter shows the number it counts to, whether or not it got there. Each element keeps `data-reveal-state`, so `reveal.css` doesn't hide it again, and if a pre-hide rule of your own would, it gets `opacity: 1`.

Pass `{ revert: false }` to leave the reveals' inline styles where they are, for content you're about to remove anyway. An element destroyed that way and later passed to `init()` starts from whatever is still inline, as if that were its own style, so use the default if you plan to `init()` it again. `destroy({ revert: false })` and `destroy(undefined, { revert: false })` are the same. A first argument that's neither a node nor an options object throws a `TypeError`.

**Content you remove needs `destroy(container)`** if it hasn't revealed yet. A play-once reveal lets go of everything once it finishes, because it has already handed its styles back, so `destroy()` has nothing left to do for it. One that's still waiting holds its tweens and ScrollTriggers until you destroy it. Reveals with `data-reveal-reverse` or `data-reveal-keep` stay until `destroy()`.

**Each instance tears down only the reveals it armed.** If two scripts on a page each create an instance, one of them calling `destroy()` leaves the other's reveals waiting to play. An element one instance has armed isn't armed again by another, even one with the same type, and that holds across separately bundled copies of the package. Once an instance lets go of its elements with a bare `destroy()`, though, another instance's next `init()` can arm them, so content the visitor has already seen animates in again. Scope `destroy(container)` to the content you're replacing to avoid that. An instance you drop without calling `destroy()` keeps its elements, and no other instance can arm them. A copy of 0.3 on the same page doesn't mark the elements it arms, so it can still arm the same elements as a 0.4 copy, and both animate them.

`destroy()` also covers an `init()` that is still loading types. That call skips the elements you destroyed, so `init(); destroy(); init()` arms each element once. An element removed from the page while its type loads isn't armed either, and a later `init()` picks it up if it comes back. A subtree that was never on the page, such as a card you call `init(card)` on just before inserting it, is armed as usual.

> **Watch out:** an element you destroy while its type is still loading never gets a `data-reveal-state`, so `reveal.css` keeps it hidden until the next `init()` reaches it or the failsafe fires (5 s by default). If you call `init()` and then `destroy()` on content that stays on the page, call `init()` on it again.

### `data-reveal-state`

`init()` sets it on every element it reaches, and a play-once reveal updates it when it finishes:

| Value | Meaning |
|-------|---------|
| `ready` | Its type took over. The reveal is waiting, playing, or plays again on every scroll back (`data-reveal-reverse`, `parallax`). |
| `done` | A play-once reveal has finished and handed its styles back, or kept them with `data-reveal-keep`. A `counter` is done when its count ends, a `split` once its own HTML is back, and a `batch` once its last item has finished. Under reduced motion, play-once reveals are done straight away. |
| `skipped` | No type is registered under that name. |
| `failed` | The type's module didn't load or its init threw. |

More values may come later, so test for the attribute being there, as `reveal.css` does, rather than for one value. To style finished elements, use `[data-reveal-state="done"]`. `destroy()` leaves the attribute in place, so the stylesheet doesn't hide content you've torn down.

A second attribute, `data-reveal-pending`, is on an element, or a `batch` item, whose reveal isn't at its end: a play-once reveal until it finishes, a reverse one while it's played out. The [print rules](#printing) use it.

## Defaults

Set house values once instead of repeating attributes on every element. Both entries take the same options:

```ts
import { createReveal } from "@boccdotdev/data-reveal";

createReveal({
  defaults: { duration: 0.35, start: "top 75%", ease: "power3.out" },
  typeDefaults: {
    batch: { distance: 40, stagger: 0.08, start: "top 88%" },
    scale: { from: 0.8 },
  },
});
```

```ts
import { createReveal } from "@boccdotdev/data-reveal/manual";
import { batch } from "@boccdotdev/data-reveal/batch";
import { fade } from "@boccdotdev/data-reveal/fade";

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
| `delay` | `fade`, `scale`, `split`, `blur`, `clip`, `rotate`, `slide` |
| `start` | every type (`parallax` ignores a global one) |
| `end` | `parallax` (ignores a global one) |
| `ease` | every type but `parallax` (`counter` ignores a global one) |
| `reverse` | every type but `parallax` |
| `keep` | `fade`, `scale`, `blur`, `clip`, `rotate`, `slide`, `batch`, `split` |
| `distance` | `fade`, `batch` |
| `stagger` | `split` (ignores a global one), `batch` |
| `direction` | `fade`, `clip`, `slide` |
| `from` | `scale` (starting scale), `counter` (starting number), both ignoring a global one |
| `to`, `decimals`, `separator`, `prefix`, `suffix` | `counter` |
| `blur` | `blur` |
| `axis`, `rotate` | `rotate` |
| `split`, `aria` | `split` |
| `speed` | `parallax` |

Values in `defaults` and `typeDefaults` are read the same way as attributes, so `"0.5"` works for a duration, `"false"` turns `reverse` off, and an empty `start` counts as unset. Eases go by name. For a custom one, register it first, as in `CustomEase.create("house", "0.2, 0, 0, 1")`, then set `ease: "house"` or `data-reveal-ease="house"`. A function in `defaults` isn't used.

Both entries export the option types: `CreateRevealOptions`, `RevealDefaults`, `RevealOptions` and `RevealTypeDefaults`.

## Animation types

### Shared attributes

| Attribute | Default | Read by | Notes |
|-----------|---------|---------|-------|
| `data-reveal-duration` | per type, below | every type but `parallax` | Seconds |
| `data-reveal-delay` | `0` | `fade`, `scale`, `split`, `blur`, `clip`, `rotate`, `slide` | Seconds. `batch`, `counter` and `parallax` don't read it. |
| `data-reveal-start` | see below | every type | ScrollTrigger `start` |
| `data-reveal-ease` | per type, below | every type but `parallax` | Any GSAP ease by name, e.g. `power2.out` |
| `data-reveal-reverse` | off | every type but `parallax` | Play the reveal out again when scrolling back up past `start`. Without it, a reveal plays once. |
| `data-reveal-keep` | off | every type but `counter` and `parallax` | Keep the end state inline once the reveal finishes. See [after a reveal](#after-a-reveal). |

Each type's built-in duration and ease, used without an attribute or a default:

| Type | Duration | Ease |
|------|----------|------|
| `fade` | `0.5` | `back.out(1.4)` |
| `scale` | `0.5` | `back.out(1.4)` |
| `split` | `0.5` | `back.out(1.7)` |
| `batch` | `0.45` | `back.out(1.4)` in, `power2.in` out with `data-reveal-reverse` (an ease you set applies both ways) |
| `blur` | `0.6` | `power2.out` |
| `clip` | `0.7` | `power3.out` |
| `rotate` | `0.7` | `power3.out` |
| `slide` | `0.6` | `power3.out` |
| `counter` | `1.5` | `power1.out` |
| `parallax` | scrubbed with the scroll | none |

Each type keeps its built-in ease whatever `gsap.defaults()` says.

`direction`, on `fade`, `slide` and `clip`, is the direction of travel: `left` moves the element leftwards into place (it starts to the right), and `up` moves it up from below.

The built-in start is `top 85%`: a reveal plays once the element's top is 85% of the way down the viewport. An element near the end of the page, such as one in the footer, may never scroll that far up. With the built-in start it still plays, once the page is scrolled to the bottom, or straight away on a page too short to scroll. The start is measured against the element's scroller, so this holds inside a scrolling container set with `ScrollTrigger.defaults({ scroller })` too. A start you set yourself is used exactly as given. To get the same for it, wrap it in `clamp()`, as in `data-reveal-start="clamp(top 75%)"`. Keep that to content below the fold: `clamp()` also holds back content that's in view when the page loads until the first scroll.

### After a reveal

When a play-once reveal finishes, it leaves nothing inline. The props it animated (`opacity`, `transform`, `translate`, `rotate`, `scale`, `transform-origin`, `clip-path`, `filter`) go back to the element's own CSS without a jump, because each reveal ends where that CSS puts the element:

- at its own opacity, so a `.muted { opacity: 0.6 }` element ends at 0.6, without passing it on the way;
- at its own transform, including the `translate`, `rotate` and `scale` properties that Tailwind v4's utilities set. `fade`, `slide`, `scale`, `rotate` and `batch` items start from that transform plus their own offset, so an element centred with `translateX(-50%)` stays centred while it slides in, and `scale`'s `from` is relative to the element's own scale. `rotate` turns around the element's own `transform-origin`.

Before 0.4 the end state stayed inline, which got in the way:

- Any transform, even `translate(0, 0)`, makes the element the containing block for `position: fixed` descendants, so a fixed overlay inside it scrolled with it.
- `clip-path: inset(0)` cut off anything that overflowed the box, such as shadows, badges and dropdowns.
- Inline `opacity: 1` beat classes, such as a hover dim.

Two cases keep the end state inline. `data-reveal-reverse` needs it to play backwards, and `data-reveal-keep` (or `keep` in the defaults) asks for it. A finished `split` goes further and puts the element's own HTML back.

`init()` checks once whether an element's CSS sets `translate`, `rotate` or `scale`. If that changes later, say across a breakpoint, `destroy()` those elements and `init()` them again.

An element can be a reveal of its own and a `batch` item at the same time. The first of the two to start animating it plays, and the other leaves the element alone and finishes with it, so it animates once.

### `fade`

Fade in while moving into place.

| Attribute | Default | Values |
|-----------|---------|--------|
| `data-reveal-direction` | `up` | `up` `down` `left` `right`: the direction it moves |
| `data-reveal-distance` | `20` | px |

### `scale`

Fade in while scaling up.

| Attribute | Default | Notes |
|-----------|---------|-------|
| `data-reveal-from` | `0.92` | Starting scale, relative to the element's own |

### `split`

Text revealed character by character, word by word or line by line, using SplitText.

| Attribute | Default | Values |
|-----------|---------|--------|
| `data-reveal-split` | `chars` | `chars` `words` `lines` |
| `data-reveal-stagger` | `0.02` | Seconds between pieces |
| `data-reveal-aria` | `hidden` for chars, `none` for words and lines | `hidden` `none` `auto` |

Lines are measured when the text is split, so `split` splits again, and rebuilds its animation, when a web font finishes loading or the element's width changes. That includes an element you `init()` before it's in the page, which gets its real width once you insert it. Words and characters don't depend on layout, so they're split once.

When a play-once split finishes, it puts the element's own HTML back: the original text for assistive tech and copy and paste, and nothing left to split again. With `data-reveal-reverse` or `data-reveal-keep` the split stays, and a `lines` split keeps re-splitting.

How the text reaches screen readers depends on `aria`:

- **`hidden`** (the default for `chars`). One element per character is read letter by letter by some screen readers, so each word's pieces are hidden from assistive tech, with a visually hidden copy of the word in front of them. The element keeps its own role, and links keep their name and stay out of hidden content.
- **`none`** (the default for `words` and `lines`). The real words stay in the page and are read as they are.
- **`auto`** is SplitText's own: an `aria-label` on the element. That isn't allowed on a plain `<p>`, `<span>` or `<div>`, where screen readers then read nothing, so only choose it on a heading or an element with a role that can be named.

Set `data-reveal-aria`, or `aria` in `typeDefaults.split`, to change it.

With `hidden`, the copies are in the page for as long as the element is split: until its reveal finishes, and for good with `data-reveal-reverse` or `data-reveal-keep`. They can't be selected, so copy and paste gets each word once. The element's `textContent` has every word twice, though, and the browser's find in page can match a word's copy as well as the word.

The pieces are `<span>`s with the classes `data-reveal-char`, `data-reveal-word` and `data-reveal-line`, so style them with those. They're only in the page while the element is split.

Splitting collapses white space, so line breaks that come from `white-space: pre-line` disappear while the element is split. Use `<br>` for line breaks in split text. Reduced motion doesn't split at all.

### `batch`

A staggered reveal of a group of items as they enter together. The items are the elements marked `data-reveal-item`, or else the element's children, leaving out ones that don't render: `<template>` (Alpine's `x-for`, say), `<script>`, `<style>`, `<link>`, `<meta>` and `<noscript>`.

| Attribute | Default | Notes |
|-----------|---------|-------|
| `data-reveal-stagger` | `0.06` | Seconds between items |
| `data-reveal-distance` | `20` | px each item moves up |

```html
<ul data-reveal="batch">
  <li data-reveal-item>One</li>
  <li data-reveal-item>Two</li>
</ul>
```

An item with no size when the batch arms, such as one in a container that's `display: none`, one hidden below a breakpoint, one in a closed `<details>`, or one in a grid or track a script sizes later, waits until it gets one, then reveals as it's scrolled to, like the rest. It stays hidden meanwhile, keeps the batch from finishing (`data-reveal-state` stays `ready`), and costs nothing. An item you take out of the page before it reveals, as filter or pagination code does, stops counting at the next `init()` over the batch and is put back as written, so if you put it back later it just shows. Without `data-reveal-item`, a child with no size, such as an infinite scroll's 0-height sentinel, is left as it is instead and doesn't hold the batch up. It joins the batch if it gets a size before the batch is done, and otherwise just shows when it does.

To add items later, as a load-more or infinite scroll does, append them and call `init()` over the batch again, on the container or anything around it. The new items reveal with the batch's settings, staggered among themselves as they enter, and the ones already shown stay as they are. Items still waiting from before and new ones that enter at the same moment get a stagger each, not one between them.

```ts
list.append(...newItems);
await reveal.init(list);
```

Call `init()` in the same task as the append, before the browser paints. New items in view that have already painted are hidden and replay, so they blink. That happens when `init()` runs from a callback that comes after the content is on screen, such as htmx's `htmx:afterSettle` or an "images loaded" callback.

### `blur`

Fade in from a blur.

| Attribute | Default | Notes |
|-----------|---------|-------|
| `data-reveal-blur` | `12` | Starting blur in px |

### `clip`

A `clip-path` wipe.

| Attribute | Default | Values |
|-----------|---------|--------|
| `data-reveal-direction` | `up` | `up` `down` `left` `right`: the direction the wipe travels |

### `rotate`

A 3D turn into place.

| Attribute | Default | Values |
|-----------|---------|--------|
| `data-reveal-axis` | `x` | `x` `y` `z` |
| `data-reveal-rotate` | `90` | Degrees it starts turned by |

### `slide`

Slide in from a full box's length away.

| Attribute | Default | Values |
|-----------|---------|--------|
| `data-reveal-direction` | `up` | `up` `down` `left` `right`: the direction it moves |

### `counter`

Counts a number up as it enters view. Reads the target from `data-reveal-to`, or else from the element's text.

| Attribute | Default | Notes |
|-----------|---------|-------|
| `data-reveal-to` | the element's text | Target number |
| `data-reveal-from` | `0` | Starting number |
| `data-reveal-decimals` | `0` | Decimal places |
| `data-reveal-separator` | none | Thousands separator, e.g. `,` |
| `data-reveal-prefix` | none | e.g. `$` |
| `data-reveal-suffix` | none | e.g. `%` |

The count is written as plain digits with the prefix, separator and suffix you set. Text around the number in the element, such as "1 200 €", isn't kept while it counts.

### `parallax`

Continuous, scroll-linked movement, scrubbed with the scroll rather than played once. It does nothing under reduced motion, ignores `data-reveal-ease` and `data-reveal-reverse`, and its start isn't clamped.

| Attribute | Default | Notes |
|-----------|---------|-------|
| `data-reveal-speed` | `0.3` | Higher moves more |
| `data-reveal-start` | `top bottom` | ScrollTrigger `start` |
| `data-reveal-end` | `bottom top` | ScrollTrigger `end` |

## Printing

Nothing scrolls on paper, so a reveal still waiting below the fold, or partway through, would print blank or half shown. Two things stop that:

- **Before printing** (the browser's `beforeprint` event), every reveal an instance armed plays to its end at once. A play-once reveal finishes as it would on screen, so it hands its styles back and prints exactly as your CSS has it, and a `counter` shows the number it counts to. They stay finished afterwards. A `data-reveal-reverse` reveal shows at its end too, then goes back to where it was after printing (`afterprint`), so scrolling still plays it in and out. `parallax` prints where the scroll has it. This needs no stylesheet.
- **Print rules in `reveal.css`**, for printing that doesn't fire `beforeprint` first, such as some PDF tools. They show in full whatever is marked `data-reveal-pending`: a play-once reveal that hasn't finished, a reverse one that has played out, a `batch` item of either, and the pieces of a `split`. Those lose the reveal's `opacity`, `transform`, `translate`, `rotate`, `scale`, `clip-path` and `filter`, and their own values of those properties with them, such as a `.muted` opacity. Reveals at their end, finished reveals and `parallax` keep their own styles, and nothing else on the page, or its layout, is touched. A `counter` that hasn't counted prints the number it starts from on this path. A `split` that's a child of a `batch` without `data-reveal-item` needs `:has()` for this (Firefox 121, Safari 15.4).

## Recipes

Each recipe uses one instance, created once:

```ts
import { createReveal } from "@boccdotdev/data-reveal";

export const reveal = createReveal();
reveal.init();
```

Two rules cover most of them:

- Destroy the reveals in content you're about to remove, with `destroy(container, { revert: false })`. Its reveals that haven't played would otherwise stay in memory, and `revert: false` saves putting styles back on content that's leaving.
- Call `init()` on new content in the same task that inserts it, before the browser paints. Called later, items already on screen are hidden and replay.

`init()` and `destroy()` can overlap safely: an `init()` still loading a type skips anything you destroyed meanwhile, so a fast navigation needs no delays or flags.

### Page transitions (Taxi, Barba, Swup)

Destroy the outgoing container's reveals as it leaves, and init the incoming one as it enters.

Taxi, from a renderer:

```ts
import { Renderer } from "@unseenco/taxi";
import { reveal } from "./reveal";

export default class RevealRenderer extends Renderer {
  onEnter() {
    if (this.content) reveal.init(this.content);
  }

  onLeaveCompleted() {
    if (this.content) reveal.destroy(this.content, { revert: false });
  }
}
```

Barba, with global hooks:

```ts
import barba from "@barba/core";
import { reveal } from "./reveal";

barba.hooks.afterLeave((data) => {
  if (data) reveal.destroy(data.current.container, { revert: false });
});
barba.hooks.beforeEnter((data) => {
  if (data) reveal.init(data.next.container);
});
// The old container is only removed after afterEnter, so measure again once it's gone.
barba.hooks.after(() => reveal.refresh());
```

Swup 4, around its content replacement (`#swup` is its default container):

```ts
import Swup from "swup";
import { reveal } from "./reveal";

const swup = new Swup();
const container = () => document.querySelector("#swup") as HTMLElement;

swup.hooks.before("content:replace", () => reveal.destroy(container(), { revert: false }));
swup.hooks.on("content:replace", () => reveal.init(container()));
```

### htmx and Sprig

Sprig runs on htmx, so the same events apply:

```ts
import { reveal } from "./reveal";

document.body.addEventListener("htmx:beforeCleanupElement", (event) => {
  const el = event.target;
  if (el instanceof Element && el.matches("[data-reveal]")) reveal.destroy(el, { revert: false });
});
document.body.addEventListener("htmx:afterSwap", () => reveal.init());
```

htmx fires `htmx:beforeCleanupElement` for each node it's about to remove, text nodes included, so only reveals that are really leaving get destroyed. A failed request, an `hx-swap="none"` or an `hx-swap="beforeend"` leaves the rest alone. `htmx:afterSwap` fires right after the new content goes in, before the browser paints it. `htmx:afterSettle` and `htmx.onLoad()` come later, so items already on screen would replay. `init()` over the whole document is cheap: it skips everything it has already handled. Over a `batch` it has armed, it picks up the batch's new items, so in an `hx-swap="beforeend"` load-more only the new items animate.

### Shopify theme editor

The theme editor reloads a section's HTML when a merchant edits it, without reloading the page:

```ts
import { reveal } from "./reveal";

document.addEventListener("shopify:section:unload", (event) => {
  reveal.destroy(event.target as Element, { revert: false });
});
document.addEventListener("shopify:section:load", (event) => {
  reveal.init(event.target as Element);
});
document.addEventListener("shopify:section:reorder", () => {
  reveal.refresh();
});
```

Without these, an edited section's reveals stay hidden and its old triggers leak. A theme's build output is committed, so use [`/manual`](#minimal-builds-manual-registration) too.

### Astro view transitions

With `<ClientRouter />`, the page is swapped on navigation, except for elements marked `transition:persist`, which carry over:

```ts
import { reveal } from "./reveal";

document.addEventListener("astro:before-swap", () => {
  for (const el of document.querySelectorAll("[data-reveal]")) {
    // Persisted elements stay, and keep their reveals.
    if (!el.closest("[data-astro-transition-persist]")) reveal.destroy(el, { revert: false });
  }
});
document.addEventListener("astro:after-swap", () => reveal.init());
```

A bare `destroy()` would forget the persisted elements too, so they'd replay on every navigation. `astro:after-swap` fires as the new page goes in, before it's shown. `astro:page-load` comes once it's visible, too late for content already on screen. Astro runs a bundled script once per visit, not on each navigation, so the instance's first `init()` covers the page the visitor lands on and `astro:after-swap` covers every page after it. Your own code that binds to elements on the page still belongs in an `astro:page-load` listener.

### Lenis

Lenis drives the scroll, so ScrollTrigger has to hear about it. Set it up as Lenis's own docs describe, and the reveals follow:

```ts
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const lenis = new Lenis();
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

The refresh that `init()` and `refresh()` run waits until the scroll has stopped, so a Lenis scroll in progress isn't cut short.

## Gotchas

- **Line breaks in split text.** Splitting collapses white space, so `white-space: pre-line` text loses its line breaks while it's split. Use `<br>`.
- **Scroll containers and carousels.** A reveal on an item inside a horizontal scroller or carousel measures against the page, not the track, and can fight the carousel's own transforms. Put a single reveal on the carousel's wrapper instead, not a `batch` on its slides. For a vertically scrolling container, tell ScrollTrigger about it with `ScrollTrigger.defaults({ scroller })` before `init()`.
- **Hash links and anchors.** A reveal moves its element while it plays, so a `#hash` link can land a few pixels off if the target, or something above it, is still mid-reveal. There's no way yet to finish reveals on demand (#26).
- **Reduced motion.** With `prefers-reduced-motion: reduce`, read when `init()` runs, no reveal animates: every type shows its element at its end state, `split` doesn't split, and `parallax` does nothing. Nothing is set inline except `opacity: 1`, where a pre-hide rule of your own would otherwise hide an element, and `counter`'s text, which shows the number it counts to. You don't need your own reduced-motion rules on top. A `transform: none !important` "to be safe" also wipes transforms your design relies on.
- **`refresh()` refreshes every ScrollTrigger** on the page, including ones the package didn't create.
- **Committed build output.** The default entry emits a chunk for every type. See [minimal builds](#minimal-builds-manual-registration).

## Upgrading from 0.3

See [UPGRADING.md](./UPGRADING.md) for the workarounds 0.4 makes unnecessary and a prompt you can give a coding agent, and [CHANGELOG.md](./CHANGELOG.md) for everything that changed.

## Development

```bash
npm install
npx playwright install   # browsers for the end-to-end tests, once
npm run typecheck        # the library, then the tests and configs
npm test                 # unit and package tests: Vitest with happy-dom
npm run test:e2e         # build, then Playwright in Chromium, Firefox and WebKit
npm run test:all         # both
```

The unit tests in `tests/unit` cover the core and the registry with stand-in types, and every type against a GSAP stand-in. The package test builds and packs the package and checks what it ships. The end-to-end tests in `tests/e2e` load fixture pages from a small local server that can fail, delay or hold back any file, to act out a broken deploy or a slow network. GSAP comes from `node_modules`, so the tests don't need the internet. To run one browser, use `npx playwright test --project=chromium`. The fixture server listens on port 4791. Set `E2E_PORT` to run a second checkout's tests at the same time.

### Demo site

`demo/` is the playground: an Astro site with a page per animation type, every setting beside the example, and the code to copy. It takes the package from the repo root, so build the package first:

```bash
npm run build            # at the root
cd demo
npm ci
npm run dev              # http://localhost:4321
```

It has its own Playwright tests and a Cloudflare deploy. [demo/README.md](./demo/README.md) has the details. The demo isn't part of the npm package.

## License

[MIT](./LICENSE)
