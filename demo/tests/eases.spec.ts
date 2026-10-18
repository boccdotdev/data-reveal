import { test, expect } from "@playwright/test";
import { gsap } from "gsap";
import { cssEasing, easingFunction } from "../src/lib/eases";

// The CSS easings stand in for GSAP's on engines that take CSS. Each must
// follow GSAP's own curve: a cubic-bezier() to within 1.5%, a linear()
// sampled from it to within 0.5%. Runs in Node, once.
test("every CSS easing follows its GSAP ease", ({ browserName }) => {
  test.skip(browserName !== "chromium", "Runs in Node; once is enough");
  for (const [name, css] of Object.entries(cssEasing)) {
    const gsapEase = gsap.parseEase(name);
    const cssEase = easingFunction(css);
    const tolerance = css.startsWith("cubic-bezier") ? 0.015 : 0.005;
    let worst = 0;
    for (let i = 0; i <= 200; i++) worst = Math.max(worst, Math.abs(gsapEase(i / 200) - cssEase(i / 200)));
    expect(worst, `${name}: ${css}`).toBeLessThanOrEqual(tolerance);
  }
});
