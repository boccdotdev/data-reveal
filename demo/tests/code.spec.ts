import { test, expect } from "@playwright/test";
import { codeToTokens } from "shiki";
import { codeTheme, highlightHtml, type Run } from "../src/lib/code";
import { defaultEngine } from "../src/lib/engines";
import { htmlSnippet, initialValues, parseValues } from "../src/lib/settings";
import { types } from "../src/lib/types";

// The HTML block is coloured in the browser by highlightHtml(), the others
// by Shiki. For the HTML the site writes, both must colour every piece the
// same. Runs in Node, once.
function merge(runs: Run[]): Run[] {
  const merged: Run[] = [];
  for (const run of runs) {
    if (!run.text.trim()) continue;
    const color = run.color.toLowerCase();
    const last = merged.at(-1);
    if (last && last.color === color) last.text += run.text;
    else merged.push({ text: run.text, color });
  }
  return merged.map(({ text, color }) => ({ text: text.replace(/\s+/g, " ").trim(), color }));
}

test("the HTML highlighter colours the snippets as Shiki does", async ({ browserName }) => {
  test.skip(browserName !== "chromium", "Runs in Node; once is enough");
  for (const type of types) {
    for (const values of [initialValues(type), parseValues(type, "reverse=true&start=top+75%25&ease=expo.out")]) {
      const html = htmlSnippet(type, values, defaultEngine);
      const { tokens } = await codeToTokens(html, { lang: "html", theme: codeTheme });
      const shiki = tokens.flatMap((line, i) => [
        ...line.map((token) => ({ text: token.content, color: token.color ?? codeTheme.fg })),
        ...(i < tokens.length - 1 ? [{ text: "\n", color: codeTheme.fg }] : []),
      ]);
      expect(merge(highlightHtml(html)), `${type.id}: ${html}`).toEqual(merge(shiki));
    }
  }
});
