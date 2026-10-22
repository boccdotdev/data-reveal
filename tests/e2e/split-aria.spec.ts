import { expect, initResult, test } from "./helpers";

test.describe("split text and assistive tech", () => {
  test.beforeEach(async ({ page, fixtureUrl }) => {
    await page.goto(fixtureUrl("split-aria"));
    expect(await initResult(page)).toBe("resolved");
    // Every split in this page keeps its pieces except #once.
    await expect(page.locator("#para .data-reveal-word").first()).toBeAttached();
  });

  test("chars are read as words, and the element keeps its role", async ({ page }) => {
    await expect(page.locator("#heading")).toMatchAriaSnapshot(`- heading "Split heading" [level=2]`);
    await expect(page.locator("#para")).toMatchAriaSnapshot(`- paragraph: Split paragraph text`);
  });

  test("a link split into chars keeps its name, and nothing focusable is hidden", async ({ page }) => {
    await expect(page.locator("#linked")).toMatchAriaSnapshot(`
      - paragraph:
        - text: Read
        - link "the guide"
        - text: first
    `);
    const hiddenFocusable = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href], button, [tabindex]")).filter((element) =>
        element.closest('[aria-hidden="true"]'),
      ).length,
    );
    expect(hiddenFocusable).toBe(0);
  });

  test("no aria-label lands on an element whose role doesn't allow one", async ({ page }) => {
    for (const id of ["para", "linked", "words", "lines"]) {
      await expect(page.locator(`#${id}`)).not.toHaveAttribute("aria-label");
    }
  });

  test("words and lines are read as they are", async ({ page }) => {
    await expect(page.locator("#words")).toMatchAriaSnapshot(`- paragraph: Split into words`);
    await expect(page.locator("#lines")).toMatchAriaSnapshot(`- paragraph: Split into lines`);
    await expect(page.locator("#words [aria-hidden]")).toHaveCount(0);
  });

  test('data-reveal-aria="auto" uses SplitText\'s own aria-label', async ({ page }) => {
    await expect(page.locator("#auto")).toHaveAttribute("aria-label", "Labelled by SplitText");
  });

  test("copying a split that's waiting to play copies its text once", async ({ page }) => {
    const waiting = page.locator("#waiting");
    await expect(waiting.locator('[aria-hidden="true"]').first()).toBeAttached();
    const copied = await waiting.evaluate((element) => {
      const selection = window.getSelection() as Selection;
      selection.selectAllChildren(element);
      return selection.toString();
    });
    expect(copied).toBe("Copy this text once, please");
  });

  test("a finished play-once split leaves no copies or hidden pieces behind", async ({ page }) => {
    const once = page.locator("#once");
    await expect(once.locator("*")).toHaveCount(0);
    await expect(once).toHaveText("Back to plain text");
    await expect(once).toMatchAriaSnapshot(`- paragraph: Back to plain text`);
  });
});
