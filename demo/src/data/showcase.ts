import type { RevealType } from "@boccdotdev/data-reveal";
import type { ImageMetadata } from "astro";

export interface ShowcaseEntry {
  /** The site's name as it should read in the list. */
  name: string;
  url: string;
  /** The reveal types the site uses, shown as their icons. */
  types: RevealType[];
  /** A screenshot, imported from src/assets/showcase/, as in `import shot from "../assets/showcase/site.png"`. */
  image?: ImageMetadata;
  /** The year it went live. */
  year?: number;
  /** A few words shown under the name. */
  note?: string;
}

// Sites built with the package, for /showcase/. Listing a site names it in
// public, so only add one its owner has agreed to.
export const showcase: ShowcaseEntry[] = [];
