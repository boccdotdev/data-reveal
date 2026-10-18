// The ease presets, in a form every engine can use: GSAP takes the name
// (`power3.out`), and a WAAPI or Motion engine takes the CSS easing.

export interface EaseFamily {
  id: string;
  label: string;
}

export const families: EaseFamily[] = [
  { id: "none", label: "Linear" },
  { id: "sine", label: "Sine" },
  { id: "power1", label: "Power 1" },
  { id: "power2", label: "Power 2" },
  { id: "power3", label: "Power 3" },
  { id: "power4", label: "Power 4" },
  { id: "expo", label: "Expo" },
  { id: "circ", label: "Circ" },
  { id: "back", label: "Back" },
  { id: "elastic", label: "Elastic" },
  { id: "bounce", label: "Bounce" },
];

export type EaseDirection = "in" | "out" | "inOut";

export const directions: Array<{ id: EaseDirection; label: string }> = [
  { id: "in", label: "In" },
  { id: "out", label: "Out" },
  { id: "inOut", label: "In-out" },
];

// The CSS easing for each GSAP ease the playground uses, the presets and the
// types' built-in ones. cubic-bezier() where it stays within 1.5% of GSAP's
// curve; otherwise linear(), sampled from gsap.parseEase() to within 0.4%.
// tests/eases.spec.ts checks every entry against GSAP.
export const cssEasing: Record<string, string> = {
  none: "linear",
  "sine.in": "cubic-bezier(0.12, 0, 0.39, 0)",
  "sine.out": "cubic-bezier(0.61, 1, 0.88, 1)",
  "sine.inOut": "cubic-bezier(0.37, 0, 0.63, 1)",
  "power1.in": "cubic-bezier(0.11, 0, 0.5, 0)",
  "power1.out": "cubic-bezier(0.5, 1, 0.89, 1)",
  "power1.inOut": "cubic-bezier(0.45, 0, 0.55, 1)",
  "power2.in": "cubic-bezier(0.32, 0, 0.67, 0)",
  "power2.out": "cubic-bezier(0.33, 1, 0.68, 1)",
  "power2.inOut": "cubic-bezier(0.65, 0, 0.35, 1)",
  "power3.in": "cubic-bezier(0.5, 0, 0.75, 0)",
  "power3.out": "cubic-bezier(0.25, 1, 0.5, 1)",
  "power3.inOut":
    "linear(0, 0.002 12.5%, 0.012 19.8%, 0.037 26.1%, 0.079 31.5%, 0.112 34.4%, 0.152 37.1%, 0.199 39.7%, 0.251 42.1%, 0.311 44.4%, 0.377 46.6%, 0.443 48.5%, 0.593 52.5%, 0.7 56%, 0.756 58.2%, 0.803 60.4%, 0.883 65.2%, 0.917 68.1%, 0.945 71.2%, 0.982 78.1%, 0.997 86.2%, 1)",
  "power4.in": "cubic-bezier(0.64, 0, 0.78, 0)",
  "power4.out": "cubic-bezier(0.22, 1, 0.36, 1)",
  "power4.inOut":
    "linear(0, 0.001 14.9%, 0.009 22.3%, 0.03 28.4%, 0.067 33.4%, 0.098 36.1%, 0.137 38.6%, 0.183 40.9%, 0.238 43.1%, 0.299 45.1%, 0.367 47%, 0.438 48.7%, 0.597 52.1%, 0.711 55.2%, 0.77 57.2%, 0.819 59.2%, 0.861 61.3%, 0.898 63.6%, 0.929 66.2%, 0.955 69.1%, 0.986 75.7%, 0.998 83.7%, 1)",
  "expo.in": "cubic-bezier(0.7, 0, 0.84, 0)",
  "expo.out": "cubic-bezier(0.16, 1, 0.3, 1)",
  "expo.inOut":
    "linear(0, 0.002 16%, 0.01 24.2%, 0.031 30.6%, 0.068 35.7%, 0.098 38.2%, 0.135 40.5%, 0.181 42.6%, 0.235 44.5%, 0.296 46.2%, 0.364 47.7%, 0.435 49%, 0.599 51.6%, 0.66 52.8%, 0.715 54.1%, 0.771 55.7%, 0.821 57.5%, 0.863 59.4%, 0.898 61.5%, 0.929 64%, 0.953 66.8%, 0.985 73.7%, 0.997 82.5%, 1)",
  "circ.in": "cubic-bezier(0.55, 0, 1, 0.45)",
  "circ.out": "cubic-bezier(0, 0.55, 0.45, 1)",
  "circ.inOut":
    "linear(0, 0.01 9.8%, 0.038 19.2%, 0.084 27.8%, 0.147 35.4%, 0.186 38.9%, 0.229 42%, 0.276 44.7%, 0.324 46.8%, 0.375 48.4%, 0.423 49.4%, 0.445 49.7%, 0.468 49.9%, 0.532 50.1%, 0.555 50.3%, 0.594 50.9%, 0.633 51.8%, 0.679 53.3%, 0.722 55.2%, 0.763 57.5%, 0.801 60.1%, 0.846 63.9%, 0.885 68.1%, 0.948 77.7%, 0.987 88.5%, 1)",
  "back.in": "cubic-bezier(0.36, 0, 0.66, -0.56)",
  "back.out": "cubic-bezier(0.34, 1.56, 0.64, 1)",
  "back.inOut":
    "linear(0, -0.008 5.2%, -0.045 17%, -0.049 22.4%, -0.042 25.6%, -0.026 28.6%, 0 31.5%, 0.034 34.2%, 0.076 36.7%, 0.126 39.1%, 0.184 41.4%, 0.252 43.7%, 0.386 47.4%, 0.572 51.6%, 0.653 53.6%, 0.735 55.9%, 0.808 58.3%, 0.874 60.9%, 0.928 63.5%, 0.972 66.2%, 1.005 69%, 1.04 73.9%, 1.05 79.3%, 1.042 84.4%, 1.006 95.5%, 1)",
  "back.out(1.4)":
    "linear(0, 0.186 4.5%, 0.351 9%, 0.497 13.6%, 0.626 18.3%, 0.736 23.1%, 0.832 28.1%, 0.909 33.2%, 0.971 38.5%, 1.013 43.3%, 1.043 48.4%, 1.062 53.8%, 1.07 59.5%, 1.063 68.8%, 1.011 90.3%, 1)",
  "back.out(1.7)":
    "linear(0, 0.195 4.4%, 0.366 8.8%, 0.518 13.3%, 0.654 18%, 0.771 22.8%, 0.868 27.7%, 0.948 32.8%, 1.011 38.1%, 1.051 42.8%, 1.079 47.8%, 1.095 53%, 1.1 58.6%, 1.083 68.8%, 1.012 91%, 1)",
  "elastic.in":
    "linear(0, 0.002 13.3%, -0.006 27.8%, 0.016 42.5%, 0.004 46.8%, -0.042 54.3%, -0.046 57.3%, -0.035 59.5%, -0.012 61.7%, 0.118 69.3%, 0.13 70.8%, 0.13 72.2%, 0.121 73.3%, 0.103 74.4%, 0.074 75.5%, 0.037 76.6%, -0.052 78.6%, -0.267 82.7%, -0.333 84.3%, -0.368 85.8%, -0.37 87.1%, -0.346 88.2%, -0.296 89.3%, -0.219 90.4%, -0.115 91.5%, 0 92.5%, 0.132 93.5%, 0.278 94.5%, 0.628 96.8%, 0.782 97.9%, 0.913 99%, 0.961 99.5%, 1)",
  "elastic.out":
    "linear(0, 0.039 0.5%, 0.087 1%, 0.218 2.1%, 0.372 3.2%, 0.722 5.5%, 0.868 6.5%, 1 7.5%, 1.115 8.5%, 1.219 9.6%, 1.296 10.7%, 1.346 11.8%, 1.37 12.9%, 1.368 14.2%, 1.333 15.7%, 1.267 17.3%, 1.052 21.4%, 0.963 23.4%, 0.926 24.5%, 0.897 25.6%, 0.879 26.7%, 0.87 27.8%, 0.87 29.2%, 0.882 30.7%, 1.012 38.3%, 1.035 40.5%, 1.046 42.7%, 1.042 45.7%, 0.996 53.2%, 0.984 57.5%, 1.006 72.2%, 0.998 86.7%, 1)",
  "elastic.inOut":
    "linear(0, -0.005 19.2%, 0.023 27.9%, 0.023 30.2%, 0.014 31.9%, -0.005 33.5%, -0.11 39.1%, -0.118 40.2%, -0.114 41.2%, -0.099 42.1%, -0.071 43%, -0.028 43.9%, 0.029 44.8%, 0.083 45.5%, 0.153 46.3%, 0.427 49.1%, 0.582 51%, 0.828 53.5%, 0.933 54.7%, 0.998 55.6%, 1.044 56.4%, 1.082 57.3%, 1.106 58.2%, 1.118 59.4%, 1.112 60.7%, 1.093 62%, 1.005 66.5%, 0.985 68.2%, 0.976 69.9%, 0.977 72.2%, 1.005 80.8%, 1)",
  "bounce.in":
    "linear(0, 0.016 4.5%, 0 9.1%, 0.028 11.4%, 0.047 13.7%, 0.062 18.2%, 0.047 22.7%, 0.001 27.3%, 0.109 31.8%, 0.152 34.1%, 0.188 36.4%, 0.234 40.9%, 0.25 45.4%, 0.235 49.9%, 0.216 52.2%, 0.188 54.5%, 0.111 59%, 0.06 61.3%, 0.001 63.6%, 0.25 68.5%, 0.445 72.9%, 0.614 77.4%, 0.752 81.9%, 0.86 86.4%, 0.937 90.9%, 0.984 95.4%, 0.996 97.7%, 1)",
  "bounce.out":
    "linear(0, 0.004 2.3%, 0.016 4.6%, 0.063 9.1%, 0.14 13.6%, 0.248 18.1%, 0.386 22.6%, 0.555 27.1%, 0.75 31.5%, 0.999 36.4%, 0.94 38.7%, 0.889 41%, 0.812 45.5%, 0.766 50%, 0.754 52.3%, 0.75 54.6%, 0.766 59.1%, 0.812 63.6%, 0.889 68.1%, 0.94 70.4%, 0.999 72.7%, 0.953 77.3%, 0.938 81.8%, 0.953 86.3%, 0.972 88.6%, 1 90.9%, 0.984 95.5%, 1)",
  "bounce.inOut":
    "linear(0, 0.008 2.3%, 0 4.5%, 0.024 6.9%, 0.031 9.1%, 0.024 11.3%, 0 13.6%, 0.057 16%, 0.094 18.2%, 0.117 20.4%, 0.125 22.7%, 0.118 24.9%, 0.095 27.2%, 0.056 29.5%, 0 31.8%, 0.122 34.2%, 0.22 36.4%, 0.303 38.6%, 0.375 40.9%, 0.434 43.4%, 0.473 45.8%, 0.495 48.1%, 0.503 51.4%, 0.515 53.2%, 0.544 55.4%, 0.587 57.6%, 0.657 60.2%, 0.752 62.9%, 0.863 65.5%, 1 68.2%, 0.944 70.5%, 0.905 72.8%, 0.883 75%, 0.875 77.3%, 0.883 79.5%, 0.906 81.8%, 0.943 84%, 1 86.4%, 0.977 88.6%, 0.969 90.9%, 0.976 93.1%, 1 95.5%, 0.992 97.8%, 1)",
};

/** The GSAP name for a family and direction: `power3.out`, or `none`. */
export function gsapEase(family: string, direction: EaseDirection): string {
  return family === "none" ? "none" : `${family}.${direction}`;
}

/** The family and direction a GSAP ease name is made of, if it's one of the presets. */
export function splitEase(ease: string): { family: string; direction: EaseDirection } | null {
  if (ease === "none") return { family: "none", direction: "out" };
  const [family, direction] = ease.split(".");
  if (!families.some((f) => f.id === family)) return null;
  if (!directions.some((d) => d.id === direction)) return null;
  return { family, direction: direction as EaseDirection };
}

// cubic-bezier(x1, y1, x2, y2), solved for y at x by bisection.
function bezier([x1, y1, x2, y2]: number[]): (x: number) => number {
  const at = (a: number, b: number, t: number): number => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  return (x) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

// linear(), with the stops this file writes: a value and an optional position.
function piecewise(stops: string[]): (x: number) => number {
  const points = stops.map((stop, i) => {
    const [value, position] = stop.trim().split(/\s+/);
    const x = position ? parseFloat(position) / 100 : i === 0 ? 0 : 1;
    return [x, parseFloat(value)] as const;
  });
  return (x) => {
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      if (x <= x1) return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return points[points.length - 1][1];
  };
}

// steps(n) or steps(n, jump-start), for an engine that takes them.
function steps([count, position]: string[]): (x: number) => number {
  const n = Math.max(1, parseInt(count, 10) || 1);
  const start = /start/.test(position ?? "");
  return (x) => Math.min(1, (Math.floor(x * n) + (start ? 1 : 0)) / n);
}

/** The curve a CSS easing draws, as progress (0 to 1) in, eased progress out. */
export function easingFunction(css: string): (x: number) => number {
  const args = css.match(/\((.*)\)/)?.[1] ?? "";
  if (css.startsWith("cubic-bezier")) return bezier(args.split(",").map(Number));
  if (css.startsWith("linear(")) return piecewise(args.split(","));
  if (css.startsWith("steps(")) return steps(args.split(",").map((part) => part.trim()));
  return (x) => x;
}

/**
 * An SVG path of the curve, in a 100 × 100 box with room above and below for
 * eases that overshoot (back, elastic), all drawn at the same scale.
 */
export function curvePath(css: string): string {
  const ease = easingFunction(css);
  const steps = 96;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = i / steps;
    const y = 72 - ease(x) * 44;
    points.push(`${(14 + x * 72).toFixed(2)} ${y.toFixed(2)}`);
  }
  return `M${points.join("L")}`;
}
