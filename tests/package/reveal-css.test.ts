// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import atImport from "postcss-import";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));
const work = realpathSync(mkdtempSync(join(tmpdir(), "data-reveal-pack-")));
const installed = join(work, "node_modules/@boccdotdev/data-reveal");

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

describe("packed package", () => {
  beforeAll(() => {
    // Built first, so only a `files` list that leaves something out can fail
    // the check on what the package ships.
    execFileSync("npm", ["run", "build"], { cwd: root, stdio: "ignore" });
    const [packed] = JSON.parse(
      execFileSync("npm", ["pack", "--json", "--pack-destination", work], { cwd: root, encoding: "utf8" }),
    ) as Array<{ filename: string }>;
    mkdirSync(installed, { recursive: true });
    execFileSync("tar", ["-xzf", join(work, packed.filename), "-C", installed, "--strip-components=1"]);
  }, 60_000);

  it("ships every file its exports point to", () => {
    type Target = string | Record<string, string>;
    const { exports } = JSON.parse(readFileSync(join(installed, "package.json"), "utf8")) as {
      exports: Record<string, Target>;
    };
    const files = Object.values(exports).flatMap((target) => (typeof target === "string" ? [target] : Object.values(target)));
    expect(files.length).toBeGreaterThan(20);
    expect(files.filter((file) => !existsSync(join(installed, file)))).toEqual([]);
  });

  it("resolves @boccdotdev/data-reveal/reveal.css through exports", () => {
    // Node's resolver goes through `exports`, as bundlers do.
    const resolved = createRequire(join(work, "main.js")).resolve("@boccdotdev/data-reveal/reveal.css");
    expect(resolved).toBe(join(installed, "reveal.css"));
  });

  it("lets postcss-import find @boccdotdev/data-reveal/reveal.css", async () => {
    // postcss-import looks for the file itself and ignores `exports`.
    const result = await postcss([atImport()]).process(`@import "@boccdotdev/data-reveal/reveal.css";`, {
      from: join(work, "main.css"),
    });
    expect(result.css).toContain("@keyframes data-reveal-failsafe");
  });
});
