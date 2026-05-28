import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registry } from "../core/registry.js";
import { num } from "../internal/attrs.js";
import { revealTrigger } from "../internal/trigger.js";
import type { RevealInit } from "../internal/types.js";

gsap.registerPlugin(ScrollTrigger);

export const init: RevealInit = (el, { reduced }) => {
  const raw = el.dataset.revealTo ?? el.textContent ?? "0";
  const to = parseFloat(raw.replace(/[^0-9.\-]/g, "")) || 0;
  const from = num(el.dataset.revealFrom, 0);
  const duration = num(el.dataset.revealDuration, 1.5);
  const decimals = num(el.dataset.revealDecimals, 0);
  const separator = el.dataset.revealSeparator;
  const prefix = el.dataset.revealPrefix ?? "";
  const suffix = el.dataset.revealSuffix ?? "";

  const format = (value: number): string => {
    const fixed = value.toFixed(decimals);
    if (!separator) return `${prefix}${fixed}${suffix}`;
    const [intPart, decPart] = fixed.split(".");
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    return `${prefix}${decPart ? `${grouped}.${decPart}` : grouped}${suffix}`;
  };

  if (reduced) {
    el.textContent = format(to);
    return;
  }

  const counter = { value: from };
  el.textContent = format(from);

  const tween = gsap.to(counter, {
    value: to,
    duration,
    ease: "power1.out",
    onUpdate: () => {
      el.textContent = format(counter.value);
    },
    scrollTrigger: revealTrigger(el),
  });

  registry.track(tween);
};
