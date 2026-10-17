import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import type { RevealTestOptions } from "./tests/e2e/helpers";

// E2E_PORT lets two checkouts run their tests side by side.
const port = Number(process.env.E2E_PORT ?? 4791);
const root = realpathSync(fileURLToPath(new URL(".", import.meta.url)));

export default defineConfig<RevealTestOptions>({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // A rare browser hiccup under CI load shouldn't fail the run. Locally a
  // failure is always reported.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  // Each project can also set `engine` once there is more than one.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "node tests/e2e/server.mjs",
    // Answers 200 only from this checkout's server; see server.mjs.
    url: `http://127.0.0.1:${port}/health?root=${encodeURIComponent(root)}`,
    env: { PORT: String(port) },
    reuseExistingServer: !process.env.CI,
  },
});
