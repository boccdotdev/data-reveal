import { cssEasing } from "./eases";
import type { Engine } from "./engines";
import type { Control, TypeSpec } from "./types";

// One type's settings: each control's value as its attribute would hold it,
// plus `ease` ("" for the type's built-in one, else a GSAP ease name).
export type Values = Record<string, string>;

/** Where a type's page starts. */
export function initialValues(type: TypeSpec): Values {
  const values: Values = { ease: "" };
  for (const control of type.controls) values[control.key] = control.initial ?? control.default;
  return values;
}

/** The ease as this engine's `data-reveal-ease` takes it. */
export function easeValue(ease: string, engine: Engine): string {
  return engine.ease === "css" ? (cssEasing[ease] ?? ease) : ease;
}

/**
 * The `data-reveal-*` attributes these settings need: only the options that
 * differ from the package's own values. A toggle that's on is a bare
 * attribute (null value).
 */
export function attributes(type: TypeSpec, values: Values, engine: Engine): Array<[string, string | null]> {
  const list: Array<[string, string | null]> = [];
  const add = (control: Control): void => {
    const value = values[control.key] ?? control.default;
    if (value === control.default) return;
    if (control.kind !== "toggle") list.push([`data-reveal-${control.key}`, value]);
    else if (value === "true") list.push([`data-reveal-${control.key}`, null]);
  };
  // The type's own options, then the ease, then timing and trigger.
  type.controls.filter((control) => control.group === "options").forEach(add);
  if (type.ease !== null && values.ease && values.ease !== type.ease) {
    list.push(["data-reveal-ease", easeValue(values.ease, engine)]);
  }
  type.controls.filter((control) => control.group !== "options").forEach(add);
  return list;
}

const escape = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** The type's element with these settings, as the HTML code block shows it, ready to paste. */
export function htmlSnippet(type: TypeSpec, values: Values, engine: Engine): string {
  const { tag, attrs = [], lines } = type.snippet;
  const all = [
    ...attrs,
    `data-reveal="${type.id}"`,
    ...attributes(type, values, engine).map(([name, value]) => (value === null ? name : `${name}="${escape(value)}"`)),
  ];
  const open = all.length > 1 ? `<${tag}\n  ${all.join("\n  ")}\n>` : `<${tag} ${all[0]}>`;
  if (!lines) return open;
  if (all.length === 1 && lines.length === 1) return `${open}${lines[0]}</${tag}>`;
  return `${open}\n${lines.map((line) => `  ${line}`).join("\n")}\n</${tag}>`;
}

/** The settings as a query string: the engine and every value that isn't the default. */
export function settingsQuery(type: TypeSpec, values: Values, engine: Engine): string {
  const params = new URLSearchParams({ engine: engine.id });
  if (type.ease !== null && values.ease && values.ease !== type.ease) params.set("ease", values.ease);
  for (const control of type.controls) {
    const value = values[control.key] ?? control.default;
    if (value !== control.default) params.set(control.key, value);
  }
  return params.toString();
}

/**
 * Reads a type's settings back from a query string. Only the type's own
 * controls and a known ease are taken, so a hand-edited URL can't add other
 * attributes. Options the query leaves out are at the package's own value.
 */
export function parseValues(type: TypeSpec, query: string): Values {
  const params = new URLSearchParams(query);
  const values: Values = { ease: "" };
  for (const control of type.controls) values[control.key] = params.get(control.key) ?? control.default;
  const ease = params.get("ease");
  if (type.ease !== null && ease && Object.prototype.hasOwnProperty.call(cssEasing, ease)) values.ease = ease;
  return values;
}
