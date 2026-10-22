import { expect, initResult, leftovers, nothingLeft, scrollTo, test } from "./helpers";

test.describe("a reveal stopped while another reveal styles the same element", () => {
  test("destroy() mid-fade on a finished batch item shows it again", async ({ page, fixtureUrl }) => {
    // The fade's chunk arrives after the batch has revealed and finished.
    await page.goto(fixtureUrl("double", { faults: { delay: { fade: 800 } } }));
    const late = page.locator("#late");
    await scrollTo(page.locator("#list"));
    await expect(late).toHaveAttribute("data-reveal-state", "ready");
    // Caught partway through its three-second fade.
    await expect.poll(() => late.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0);
    expect(Number(await late.evaluate((element) => getComputedStyle(element).opacity))).toBeLessThan(1);

    await page.evaluate(() => window.__reveal.instance?.destroy(document.getElementById("late") ?? undefined));
    await expect(late).toHaveCSS("opacity", "1");
    expect(await leftovers(late)).toEqual(nothingLeft);
  });

  test("a second reveal whose init throws leaves the element as it was", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("double", { params: { init: "0" } }));
    await page.waitForFunction(() => window.__reveal?.instance != null);
    await scrollTo(page.locator("#list"));

    const result = await page.evaluate(async () => {
      // Paths the browser resolves against the fixture page.
      type Init = (el: HTMLElement, ctx: object) => void;
      type Registration = { type: string; init: Init };
      const load = (path: string) => import(/* @vite-ignore */ path);
      const { createReveal } = (await load("../dist/manual.js")) as {
        createReveal(options: { types: Registration[] }): { init(): Promise<void> };
      };
      const { batch } = (await load("../dist/types/batch.js")) as { batch: Registration };
      const { fade } = (await load("../dist/types/fade.js")) as { fade: Registration };
      await createReveal({ types: [batch] }).init();
      const late = document.getElementById("late") as HTMLElement;
      // Let the batch reveal finish first.
      await new Promise<void>((resolve) => {
        const check = () => (late.style.transform === "" ? resolve() : requestAnimationFrame(check));
        requestAnimationFrame(check);
      });
      const throwing = {
        type: "fade",
        init: (el: HTMLElement, ctx: object) => {
          fade.init(el, ctx);
          throw new Error("init threw");
        },
      };
      return createReveal({ types: [throwing] }).init().then(
        () => "resolved",
        (error: Error) => error.message,
      );
    });
    expect(result).toBe("init threw");
    const late = page.locator("#late");
    await expect(late).toHaveAttribute("data-reveal-state", "failed");
    await expect(late).toHaveCSS("opacity", "1");
    expect(await leftovers(late)).toEqual(nothingLeft);
  });
});

test.describe("an element with GSAP work of the site's own", () => {
  test("a site tween still running doesn't stop the reveal handing its styles back", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("finish"));
    expect(await initResult(page)).toBe("resolved");
    const target = page.locator("#site-tween");
    await page.evaluate(async () => {
      const { gsap } = await import("gsap");
      gsap.to("#site-tween", { backgroundColor: "#bbb", duration: 0.3, repeat: -1, yoyo: true });
    });

    await scrollTo(target);
    await expect.poll(() => leftovers(target)).toEqual(nothingLeft);
    expect(await target.evaluate((element) => element.style.opacity)).toBe("");
  });

  test("a reveal leaves the site's own GSAP rotation as it was", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("finish", { params: { init: "0" } }));
    await page.waitForFunction(() => window.__reveal?.instance != null);
    await page.evaluate(async () => {
      const { gsap } = await import("gsap");
      gsap.set("#spun", { rotation: 270 });
      await window.__reveal.instance?.init();
    });
    const spun = page.locator("#spun");
    await scrollTo(spun);
    // The reveal has handed its styles back.
    await expect.poll(() => spun.evaluate((element) => element.style.opacity)).toBe("");

    // The site turns it on to 360: a quarter turn, so 315 at the halfway mark.
    const halfway = () =>
      page.evaluate(async () => {
        const { gsap } = await import("gsap");
        const tween = gsap.to("#spun", { rotation: 360, ease: "none", paused: true });
        tween.progress(0.5);
        const rotation = gsap.getProperty("#spun", "rotation");
        tween.progress(0).kill();
        return rotation;
      });
    expect(await halfway()).toBe(315);

    // destroy() hands the transform back too.
    await page.evaluate(() => window.__reveal.instance?.destroy());
    expect(await halfway()).toBe(315);
  });
});

test.describe("SVG", () => {
  test("rotate turns an SVG element around its centre", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("svg"));
    expect(await initResult(page)).toBe("resolved");

    const centres = await page.evaluate(
      () =>
        new Promise<Array<[number, number]>>((resolve) => {
          const rect = document.getElementById("rect") as unknown as SVGGraphicsElement;
          const svg = rect.ownerSVGElement as SVGSVGElement;
          const samples: Array<[number, number]> = [];
          rect.scrollIntoView({ block: "center" });
          const sample = () => {
            const box = rect.getBoundingClientRect();
            const origin = svg.getBoundingClientRect();
            samples.push([box.x + box.width / 2 - origin.x, box.y + box.height / 2 - origin.y]);
            if (samples.length < 60) requestAnimationFrame(sample);
            else resolve(samples);
          };
          requestAnimationFrame(sample);
        }),
    );
    const twin = await page.evaluate(() => {
      const rect = document.getElementById("rect-twin") as unknown as SVGGraphicsElement;
      const box = rect.getBoundingClientRect();
      const origin = (rect.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
      return [box.x + box.width / 2 - origin.x, box.y + box.height / 2 - origin.y];
    });
    for (const [x, y] of centres) {
      expect(Math.abs(x - twin[0])).toBeLessThanOrEqual(1);
      expect(Math.abs(y - twin[1])).toBeLessThanOrEqual(1);
    }
  });

  test("destroy() mid-reveal leaves no transform on an SVG element", async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("svg"));
    expect(await initResult(page)).toBe("resolved");
    const slow = page.locator("#slow");
    await scrollTo(slow);
    await expect.poll(() => slow.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0);

    await page.evaluate(() => window.__reveal.instance?.destroy());
    expect(await slow.evaluate((element) => element.getAttribute("transform"))).toBeNull();
    const [box, twin] = await page.evaluate(() =>
      ["slow", "slow-twin"].map((id) => {
        const { x, y, width, height } = (document.getElementById(id) as unknown as SVGGraphicsElement).getBBox();
        const ctm = (document.getElementById(id) as unknown as SVGGraphicsElement).getCTM();
        return [x, y, width, height, ctm?.a ?? 1, ctm?.b ?? 0];
      }),
    );
    expect(box).toEqual(twin);
  });
});
