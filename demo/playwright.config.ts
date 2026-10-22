import { defineConfig, devices } from "@playwright/test";

// Builds the site (and a copy with a showcase entry), then serves both. Build
// the package at the repo root first: the site takes it from there.
const port = Number(process.env.E2E_PORT ?? 4794);

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "npx astro build && npx astro build --config tests/showcase.config.mjs && node tests/server.mjs",
    url: `http://127.0.0.1:${port}/health`,
    env: { PORT: String(port) },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
