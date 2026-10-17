import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The Playwright specs in tests/e2e run separately (`npm run test:e2e`).
    include: ["tests/unit/**/*.test.ts", "tests/package/**/*.test.ts"],
    environment: "happy-dom",
  },
});
