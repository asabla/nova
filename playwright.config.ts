import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "packages/web/tests/e2e",
  testMatch: "*.e2e.test.ts",
  timeout: 60_000,
  retries: 1,
  // Run test files serially to reduce rate-limit pressure
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:5173",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
