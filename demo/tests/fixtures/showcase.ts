import type { ShowcaseEntry } from "../../src/data/showcase";
import shot from "./example-site.png";

export const showcase: ShowcaseEntry[] = [
  {
    name: "Example site",
    url: "https://example.com/",
    year: 2026,
    types: ["fade", "split", "batch", "counter"],
    image: shot,
    note: "A test entry",
  },
  {
    name: "Another example",
    url: "https://example.org/",
    types: ["clip", "parallax"],
  },
];
