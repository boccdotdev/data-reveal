// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import atImport from "postcss-import";
import { afterAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));
const work = mkdtempSync(join(tmpdir(), "data-reveal-pack-"));

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

describe("packed package", () => {
  it("lets postcss-import find @boccdotdev/data-reveal/reveal.css", async () => {
    const [packed] = JSON.parse(
      execFileSync("npm", ["pack", "--json", "--pack-destination", work], { cwd: root, encoding: "utf8" }),
    ) as Array<{ filename: string }>;
    const installed = join(work, "node_modules/@boccdotdev/data-reveal");
    mkdirSync(installed, { recursive: true });
    execFileSync("tar", ["-xzf", join(work, packed.filename), "-C", installed, "--strip-components=1"]);

    const result = await postcss([atImport()]).process(`@import "@boccdotdev/data-reveal/reveal.css";`, {
      from: join(work, "main.css"),
    });
    expect(result.css).toContain("@keyframes data-reveal-failsafe");
  }, 60_000);
});
