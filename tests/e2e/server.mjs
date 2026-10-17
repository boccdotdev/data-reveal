// Static server for the end-to-end fixtures, with fault injection. No
// dependencies, so it runs anywhere Node does.
//
//   /<faults>/fixtures/<page>.html   a fixture page
//   /<faults>/dist/...               the built package (run `npm run build`)
//   /<faults>/reveal.css             the stylesheet
//   /<faults>/gsap/...               node_modules/gsap
//
// <faults> is "-" for none, or a comma-separated list of `fail=<name>`,
// `delay=<name>:<ms>` and `hang=<name>`. A fault applies to every file whose
// name without its extension is <name>: "fade" matches dist/types/fade.js,
// "ScrollTrigger" matches gsap/ScrollTrigger.js. Fixture pages build these
// URLs with relative paths, so the faults carry over to everything they load.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { basename, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const port = Number(process.env.PORT ?? 4791);

const mounts = {
  fixtures: join(root, "tests/e2e/fixtures"),
  dist: join(root, "dist"),
  gsap: join(root, "node_modules/gsap"),
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function parseFaults(segment) {
  const faults = { fail: new Set(), hang: new Set(), delay: new Map() };
  if (segment === "-") return faults;
  for (const entry of decodeURIComponent(segment).split(",")) {
    const [kind, value = ""] = entry.split("=");
    if (kind === "fail" || kind === "hang") faults[kind].add(value);
    else if (kind === "delay") {
      const [name, ms] = value.split(":");
      faults.delay.set(name, Number(ms));
    } else throw new Error(`Unknown fault "${entry}"`);
  }
  return faults;
}

function resolveFile(path) {
  if (path === "reveal.css") return join(root, "reveal.css");
  const [mount, ...rest] = path.split("/");
  const base = mounts[mount];
  if (!base) return null;
  const file = normalize(join(base, ...rest));
  // Keep requests inside their mount.
  return file.startsWith(base + sep) ? file : null;
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  if (pathname === "/health") {
    res.end("ok");
    return;
  }

  const match = pathname.match(/^\/([^/]+)\/(.+)$/);
  let faults;
  try {
    faults = match && parseFaults(match[1]);
  } catch (error) {
    res.writeHead(400).end(String(error));
    return;
  }
  const file = match && resolveFile(match[2]);
  if (!faults || !file) {
    res.writeHead(404).end("not found");
    return;
  }

  const name = basename(file, extname(file));
  if (faults.hang.has(name)) return; // never answer
  const delay = faults.delay.get(name);
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  if (faults.fail.has(name)) {
    res.writeHead(404).end("failed on purpose");
    return;
  }

  try {
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": contentTypes[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`fixtures on http://127.0.0.1:${port}`);
});
