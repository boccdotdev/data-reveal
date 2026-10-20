# data-reveal playground

The demo site for `@boccdotdev/data-reveal`. Each animation type has a page with the example running in the page and every one of its settings beside it, and a Code tab with the code to copy. It's an Astro site with static output, deployed to Cloudflare.

The site takes the package from the repo root (`"@boccdotdev/data-reveal": "file:.."`), so build the package first. GSAP is the site's own dependency, from npm.

## Run it

```bash
# at the repo root
npm ci
npm run build

# then here, in demo/
npm ci
npm run dev       # http://localhost:4321
npm run build     # static site in demo/dist
npm run preview   # serve demo/dist
npm run check     # type-check the site and its tests
```

After a change to the package, run `npm run build` at the root again. The site links to the root, so it sees the new `dist/` without another install.

## How it's put together

The routes:

- `/` is the overview: the install line, a list of the types and, once there is a showcase, a link to it.
- `/fade/`, `/scale/` and so on, one per type. `src/pages/[type].astro` makes them from the list in `src/lib/types.ts`, so a type added there gets a page and a nav link.
- `/showcase/` lists sites built with the package. It's built only once the list has a site (see [Showcase](#showcase)).
- `src/pages/404.astro` builds `404.html`, a plain page with a link to the overview. Cloudflare serves it, with a 404 status, for any address with no file (`not_found_handling` in `wrangler.jsonc`).

The shell, on every page:

- The nav is one box: the wordmark, the overview (and the showcase, once there is one), the types with their icons, then GitHub and npm at its foot, and last a row with the Sound switch.
- On wide screens a bar along the top holds the Navigation button at the left and, on a type page, the Settings button at the right. Navigation folds the nav to a rail of icons, whose names show on hover and focus, and Escape hides a name until another icon is pointed at. Settings hides the settings column. The browser remembers both. One transition on the page grid moves every edge, and once it settles the page calls the reveal's `refresh()`.
- Below 60rem the nav's own bar has Settings and Menu buttons instead. The menu and the settings open as drawers, one at a time. An open drawer takes focus, the page behind it is inert, and Escape or the button closes it and puts focus back on the button. Every control there is at least 44px to tap.

A type's page:

- The header (the type's icon, title and a line on what it does) comes first and scrolls away. Under it the Example and Code tabs have a sticky row of their own, just below the top bar. The tabs follow the ARIA tabs pattern, arrow keys included, and `#code` in the URL opens the Code tab. Back on Example, the example plays again.
- The example runs in the page itself, off the window's scroll, as on a real site. A screen of space above it ("Scroll to play", with an arrow) and another below let the page scroll it into view and on past. Replay sits inside the example at its top right and stays in reach while the example scrolls by. It goes back to the top of the example and plays it again.
- Each change of setting takes the reveal off the element with `destroy()`, puts in a fresh copy with the new `data-reveal-*` attributes and calls `init()` again.
- The Code tab has the HTML, which follows the settings, then the CSS, JS and install line. The JS import and the install line come from the engine's `entry` and `peers` in `src/lib/engines.ts`, and the settings name the built-in ease as the engine writes it.
- The page keeps its settings in its own URL, so a link opens them again. The engine is one choice for the whole site: the nav links carry it as `?engine=`, and the browser remembers it. Changing it loads the page again, so each engine starts in a clean document.
- A sticky bar along the bottom holds the previous and next types, in line with the nav's last row.
- Pages change through Astro's `<ClientRouter />`. The nav stays, and `src/scripts/reveal.ts` follows the README's Astro view transitions recipe to destroy and init the reveals around each swap.
- If a type's code fails to load, the package shows the element as written (`data-reveal-state="failed"`). The site logs the error and carries on, so the settings, tabs and code still work.

The parts:

- `src/lib/types.ts` describes each type: its title, a line on what it does, the element its code shows, and its controls (the option, the kind of control, the package's own value and the range). The settings and the HTML code come from it, and the HTML leaves out any attribute still at the package's value. A control can list the `engines` that read its option, and the page greys it out on the others. `src/components/Demo.astro` has the element each example animates.
- `src/lib/engines.ts` lists the engines. Only GSAP exists so far. Each engine names its package `entry` and the `peers` a site installs with it, and loads the entry with an import of its own, so a page downloads only its engine's code. To turn on another engine once the package has it, give it a `load` function that imports its entry and set `available: true`.
- `src/lib/eases.ts` has each ease preset as GSAP's name and as a CSS easing (`cubic-bezier()` or `linear()`) for engines that take CSS. `tests/eases.spec.ts` checks each CSS easing against GSAP's curve.
- `src/lib/code.ts` holds the code blocks' colours. Astro's Shiki colours the blocks that don't change with a theme made from them. The HTML block changes with the settings, so the page colours it with a small highlighter of its own, in the same colours. `tests/code.spec.ts` checks the two agree.
- `src/lib/icons.ts` draws each type's icon on a 20 × 20 grid, and `src/components/TypeIcon.astro` renders it in the text colour.
- `src/scripts/sound.ts` plays the interface sounds with [Foley](https://usefoley.dev/). Listeners on the document pick the cue, so the controls themselves have no sound code. A slider's note follows its value and a segmented control's follows the option, both on a pentatonic scale. Picking an ease plays its curve: a short run of gliding tones whose pitch follows the curve over time, an octave from start to end. The examples make no sound. The Sound switch in the nav turns it off, and the browser remembers that. Nothing starts the audio before the first click or key press, and a browser without Web Audio gets no sound and no Sound switch.

## Showcase

The list on `/showcase/` comes from `src/data/showcase.ts`. It ships empty, and while it's empty the site has no `/showcase/` page, no Showcase link in the nav and no link from the overview. The first entry brings all three back. Listing a site names it in public, so add one only with its owner's agreement:

```ts
import shot from "../assets/showcase/site-name.png";

export const showcase: ShowcaseEntry[] = [
  {
    name: "Site name",
    url: "https://example.com/",
    types: ["fade", "split"],
    image: shot, // optional, a screenshot about 1200 × 750
    year: 2026, // optional
    note: "Optional, a few words",
  },
];
```

Put screenshots in `src/assets/showcase/`. Entries sort newest first, then by name.

## Deploy to Cloudflare

The site deploys to Cloudflare Workers as static assets, set up in `wrangler.jsonc`. Static output needs no adapter and no Worker script.

In the Cloudflare dashboard, connect the repository as a Worker with these build settings:

- Root directory: `demo`
- Build command: `cd .. && npm ci && npm run build && cd demo && npm ci && npm run build`. The package has to be built at the root before the site.
- Deploy command: `npx wrangler deploy` (the default). Wrangler is a dev dependency at an exact version, so the deploy uses the one in the lockfile.
- Build variable: `SITE_URL`, the site's address, such as `https://data-reveal.example.com`. Set it once the domain exists. It gives each page a canonical link. Without it the pages carry no absolute URLs.

The site builds to `demo/dist`, which `wrangler.jsonc` serves, with `dist/404.html` for addresses that have no file.

## Tests

```bash
npx playwright install   # browsers, once
npm run test:e2e
```

The tests build the site twice, once as it ships and once with two made-up showcase entries (`tests/showcase.config.mjs`), and serve both with `tests/server.mjs`, which answers unknown addresses with `404.html` as Cloudflare does. They run in Chromium, Firefox and WebKit without the internet: the font stylesheet gets an empty answer, and any other request off the test server fails the test, as does any console error a test doesn't expect. The server listens on port 4794. Set `E2E_PORT` to use another, but not 4190: Firefox and WebKit refuse to load from it.

What the pages give the tests:

- `demo:sound` events on the document, one per sound, which is how the tests check the pitches, the ease sounds and that the examples stay silent.
- `demo:layout` events when the panels have changed the page's width.
- `data-example-state="ready"` on `<html>` once a type page's example is armed.
- With `?test` in the URL, `window.__engine.triggers()` counts the engine's live scroll triggers, so the tests can check that rebuilds and page changes leave none behind.

These tests aren't part of the root `npm run test:e2e`. The root CI has a `demo` job that runs `npm ci`, `npm run check` and `npm run build` here, but not Playwright.

## Fonts

- [General Sans](https://www.fontshare.com/fonts/general-sans) by Indian Type Foundry, under the ITF Free Font License. The licence doesn't allow the font files in a public repository, so the site loads them from Fontshare's API and falls back to the system font.
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/) by JetBrains, under the SIL Open Font License 1.1. The font file and its licence are in `src/assets/fonts`.
