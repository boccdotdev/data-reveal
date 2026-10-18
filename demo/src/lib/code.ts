// The code blocks: their colours, the Shiki theme built from them, and a
// small HTML highlighter for the one block that changes in the browser. Both
// paint with the same colours, so every block looks alike.
import type { Engine } from "./engines";

/** The site's own colours, plus one quiet tint for strings. */
export const codeColors = {
  background: "#1e1e1e",
  foreground: "#e1e1e1",
  punctuation: "#8f948f",
  keyword: "#f2f2f2",
  attribute: "#b8bdb8",
  string: "#d6cdb0",
  comment: "#8f948f",
} as const;

/** The Shiki theme for the blocks that don't change. */
export const codeTheme = {
  name: "data-reveal",
  type: "dark" as const,
  fg: codeColors.foreground,
  bg: codeColors.background,
  colors: {
    "editor.background": codeColors.background,
    "editor.foreground": codeColors.foreground,
  },
  tokenColors: [
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: codeColors.comment, fontStyle: "italic" } },
    { scope: ["string", "string.quoted"], settings: { foreground: codeColors.string } },
    {
      scope: ["punctuation.definition.tag", "punctuation.separator.key-value"],
      settings: { foreground: codeColors.punctuation },
    },
    {
      scope: ["entity.name.tag", "keyword", "storage", "keyword.control", "keyword.control.at-rule"],
      settings: { foreground: codeColors.keyword },
    },
    { scope: ["entity.other.attribute-name"], settings: { foreground: codeColors.attribute } },
    // A shell command's arguments read as plain text, not as strings.
    { scope: ["string.unquoted.argument"], settings: { foreground: codeColors.foreground } },
  ],
};

export interface Run {
  text: string;
  color: string;
}

// Inside a tag: the name, then attributes with optional quoted values.
const tagPattern = /^(<\/?)([\w-]+)((?:\s+[\w-]+(?:="[^"]*")?)*)(\s*\/?>)/;
const attributePattern = /(\s+)([\w-]+)(?:(=)("[^"]*"))?/g;

/**
 * Splits HTML into coloured runs, as Shiki's HTML grammar and the theme
 * above colour it: tag brackets and `=` quiet, tag names bright, attribute
 * names grey, quoted values tinted, and everything else plain. It reads the
 * HTML the playground writes, not HTML in general.
 */
export function highlightHtml(code: string): Run[] {
  const runs: Run[] = [];
  const push = (text: string, color: string): void => {
    if (text) runs.push({ text, color });
  };
  let rest = code;
  while (rest) {
    const tag = rest.startsWith("<") ? tagPattern.exec(rest) : null;
    if (!tag) {
      const next = rest.indexOf("<", 1);
      const text = next === -1 ? rest : rest.slice(0, next);
      push(text, codeColors.foreground);
      rest = rest.slice(text.length);
      continue;
    }
    const [whole, open, name, attributes, close] = tag;
    push(open, codeColors.punctuation);
    push(name, codeColors.keyword);
    for (const [, space, attribute, equals, value] of attributes.matchAll(attributePattern)) {
      push(space, codeColors.foreground);
      push(attribute, codeColors.attribute);
      if (equals) {
        push(equals, codeColors.punctuation);
        push(value, codeColors.string);
      }
    }
    const spaceBefore = close.length - close.trimStart().length;
    push(close.slice(0, spaceBefore), codeColors.foreground);
    push(close.slice(spaceBefore), codeColors.punctuation);
    rest = rest.slice(whole.length);
  }
  return runs;
}

const escapeHtml = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The runs as HTML for a `<code>` element. */
export function runsToHtml(runs: Run[]): string {
  return runs.map(({ text, color }) => `<span style="color:${color}">${escapeHtml(text)}</span>`).join("");
}

/** The JavaScript a page needs on this engine, as the README's quick start has it. */
export function jsSnippet(engine: Engine): string {
  return `import { createReveal } from "${engine.entry}";

const reveal = createReveal();
await reveal.init(); // scan the document, load only the types in use`;
}

/** The stylesheet that hides elements until their reveal is ready, imported from CSS as the README advises. */
export const cssSnippet = `@import "@boccdotdev/data-reveal/reveal.css";`;

/** The install line for this engine: the package and the engine's own peers. */
export function installSnippet(engine: Engine): string {
  return ["npm install @boccdotdev/data-reveal", ...engine.peers].join(" ");
}
