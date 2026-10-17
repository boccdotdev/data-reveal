import { expect, test } from "@playwright/test";
import { expectState, fixture, initResult } from "./helpers";

test("init() on a card before it's inserted reveals it once inserted", async ({ page }) => {
  await page.goto(fixture("basic"));
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
  await expectState(page.locator("#card"), "ready");
  await expect(page.locator("#card")).toHaveCSS("opacity", "1");
});

test("a later init() doesn't wait for a chunk that never arrives", async ({ page }) => {
  await page.goto(fixture("basic", { faults: { hang: ["split"] } }));
  await expectState(page.locator("#fade"), "ready");
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
  await expectState(page.locator("#card"), "ready");
  await expect(page.locator("#card")).toHaveCSS("opacity", "1");
});
