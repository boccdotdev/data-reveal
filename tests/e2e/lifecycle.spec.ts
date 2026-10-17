import { expect, expectArmed, expectState, finishedAt, initResult, sampleReveal, test, twinBox } from "./helpers";

test("init() on a card before it's inserted reveals it once inserted", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("basic"));
  expect(await initResult(page)).toBe("resolved");

  await page.evaluate(async () => {
    const card = document.createElement("div");
    card.id = "card";
    card.className = "box";
    card.dataset.reveal = "fade";
    card.dataset.revealDuration = "0.2";
    card.textContent = "inserted after init()";
    await window.__reveal.instance?.init(card);
    document.body.prepend(card);
  });
  await expectArmed(page.locator("#card"));
  await expect(page.locator("#card")).toHaveCSS("opacity", "1");
});

test("a later init() doesn't wait for a chunk that never arrives", async ({ page, fixtureUrl }) => {
  await page.goto(fixtureUrl("basic", { faults: { hang: ["split"] } }));
  await expectArmed(page.locator("#fade"));
  await expectState(page.locator("#split"), null);

  const outcome = await page.evaluate(async () => {
    const card = document.createElement("div");
    card.id = "card";
    card.className = "box";
    card.dataset.reveal = "scale";
    card.dataset.revealDuration = "0.2";
    document.body.prepend(card);
    const timeout = new Promise((resolve) => setTimeout(resolve, 2_000, "still waiting"));
    return Promise.race([window.__reveal.instance?.init().then(() => "resolved"), timeout]);
  });
  expect(outcome).toBe("resolved");
  await expectArmed(page.locator("#card"));
  await expect(page.locator("#card")).toHaveCSS("opacity", "1");
});

test("init(), destroy(), init() on the same content arms each reveal once, and it plays once to where its CSS puts it", async ({
  page,
  fixtureUrl,
}) => {
  await page.goto(fixtureUrl("transforms"));
  expect(await initResult(page)).toBe("resolved");
  await page.evaluate(async () => {
    window.__reveal.instance?.destroy();
    await window.__reveal.instance?.init();
  });
  const triggers = await page.evaluate(async () => {
    const { ScrollTrigger } = await import("gsap/ScrollTrigger");
    return ScrollTrigger.getAll().filter((trigger) => trigger.trigger === document.getElementById("plain")).length;
  });
  expect(triggers).toBe(1);

  const samples = await sampleReveal(page, "plain");
  // Hidden once, then handed back once.
  const changes = samples.filter((s, i) => i > 0 && s.inline !== samples[i - 1].inline).length;
  expect(changes).toBeLessThanOrEqual(1);
  const handed = finishedAt(samples);
  expect(handed).toBeGreaterThan(0);
  const twin = await twinBox(page, "plain");
  const last = samples[samples.length - 1];
  expect(Math.abs(samples[handed].y - samples[handed - 1].y)).toBeLessThanOrEqual(1);
  expect(Math.abs(last.y - twin.y)).toBeLessThanOrEqual(1);
});
