// `data-reveal-state` says how far the package got with an element. The core
// sets one on every element init() handles, whatever the outcome, so the
// pre-hide CSS (`reveal.css`) stops hiding it, which is why that CSS only
// tests for the attribute being there. "ready": its type took over.
// "skipped": no type is registered under that name. "failed": the type's
// module failed to load or its init threw. "done": a play-once reveal has
// finished, set by the type. More may be added.
export type RevealState = "ready" | "skipped" | "failed" | "done";

export function setState(el: Element, state: RevealState): void {
  el.setAttribute("data-reveal-state", state);
}

// `data-reveal-pending` marks a reveal that isn't at its end: a play-once one
// until it finishes, a reverse one while it's played out, on its element or
// on each batch item. reveal.css's print rules use it to show those in full
// when printing skipped `beforeprint`, without touching reveals at their end,
// whose styles are the element's own.
export const pendingAttribute = "data-reveal-pending";
