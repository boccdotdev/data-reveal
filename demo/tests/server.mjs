// Static server for the end-to-end tests: the built site at /, and the build
// with a showcase entry (tests/showcase.config.mjs) at /showcase-fixture/.
// A path with no file gets the site's 404.html with a 404 status, as
// Cloudflare's `not_found_handling: "404-page"` does. No dependencies.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT ?? 4794);

const mounts = [
  ["/showcase-fixture/", join(here, ".showcase-dist")],
  ["/", join(here, "../dist")],
];

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

async function resolve(pathname) {
  const [prefix, root] = mounts.find(([prefix]) => pathname.startsWith(prefix));
  let file = normalize(join(root, decodeURIComponent(pathname.slice(prefix.length))));
  if (file !== root && !file.startsWith(root + sep)) return null;
  const info = await stat(file).catch(() => null);
  if (info?.isDirectory()) file = join(file, "index.html");
  return file;
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  if (pathname === "/health") {
    res.writeHead(200).end("ok");
    return;
  }
  try {
    const file = await resolve(pathname);
    if (!file) throw new Error("outside the site");
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": contentTypes[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    const page = await readFile(join(here, "../dist/404.html")).catch(() => null);
    if (page) res.writeHead(404, { "content-type": contentTypes[".html"] }).end(page);
    else res.writeHead(404).end("not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`demo on http://127.0.0.1:${port}`);
});
