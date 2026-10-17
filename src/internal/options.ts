import type { RevealContext, RevealOptions } from "./types.js";

type Key = keyof RevealOptions;

// How each option is read, from an attribute or from `defaults` and
// `typeDefaults`, so both follow the same rules. An empty or unparsable value
// counts as unset, except for "text", where empty is a real value (an empty
// `data-reveal-separator` turns grouping off). "amount" ignores formatting,
// so `data-reveal-to="1,200"` reads as 1200. "flag" is on when present,
// unless it's "false".
const kinds: Record<Key, "number" | "amount" | "string" | "text" | "flag"> = {
  duration: "number",
  delay: "number",
  start: "string",
  end: "string",
  ease: "string",
  distance: "number",
  stagger: "number",
  direction: "string",
  from: "number",
  to: "amount",
  blur: "number",
  axis: "string",
  rotate: "number",
  split: "string",
  speed: "number",
  decimals: "number",
  separator: "text",
  prefix: "text",
  suffix: "text",
  reverse: "flag",
  keep: "flag",
};

/** One option's value, or undefined if it's unset or can't be read. */
export function parseOption<K extends Key>(key: K, raw: unknown): RevealOptions[K] | undefined {
  let value: unknown;
  switch (kinds[key]) {
    case "number":
    case "amount": {
      let parsed = NaN;
      if (typeof raw === "number") parsed = raw;
      else if (typeof raw === "string") {
        parsed = parseFloat(kinds[key] === "amount" ? raw.replace(/[^0-9.\-]/g, "") : raw);
      }
      value = Number.isNaN(parsed) ? undefined : parsed;
      break;
    }
    case "string":
      value = typeof raw === "string" && raw !== "" ? raw : undefined;
      break;
    case "text":
      value = typeof raw === "string" ? raw : undefined;
      break;
    case "flag":
      if (typeof raw === "boolean") value = raw;
      else if (typeof raw === "string") value = raw !== "false";
      break;
  }
  return value as RevealOptions[K] | undefined;
}

/** Every option `input` sets, read by the same rules as attributes. Unset ones are left out. */
export function parseOptions(input: RevealOptions | undefined): RevealOptions {
  const parsed: Record<string, unknown> = {};
  if (!input) return parsed;
  for (const key of Object.keys(kinds) as Key[]) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    const value = parseOption(key, input[key]);
    if (value !== undefined) parsed[key] = value;
  }
  return parsed as RevealOptions;
}

function attribute<K extends Key>(el: HTMLElement, key: K): RevealOptions[K] | undefined {
  // `data-reveal-duration` is `dataset.revealDuration`.
  return parseOption(key, el.dataset[`reveal${key[0].toUpperCase()}${key.slice(1)}`]);
}

/** One option: the element's attribute, then the type's defaults. Undefined if neither is set. */
export function option<K extends Key>(el: HTMLElement, ctx: RevealContext, key: K): RevealOptions[K] | undefined {
  const value = attribute(el, key);
  return value !== undefined ? value : ctx.defaults?.[key];
}

type BuiltIn = { [K in Key]?: NonNullable<RevealOptions[K]> };
type Resolved<T> = { [K in keyof T]: K extends Key ? NonNullable<RevealOptions[K]> : never };

/**
 * The options a type reads, each resolved in order: the element's attribute,
 * then the defaults passed to `createReveal()` (the type's own over the
 * global ones), then the type's built-in value from `builtIn`.
 */
export function options<T extends BuiltIn>(el: HTMLElement, ctx: RevealContext, builtIn: T): Resolved<T> {
  const resolved: Record<string, unknown> = { ...builtIn };
  for (const key of Object.keys(builtIn) as Key[]) {
    const value = option(el, ctx, key);
    if (value !== undefined) resolved[key] = value;
  }
  return resolved as Resolved<T>;
}
