import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.E2E_ACCEPTANCE
    ? [
        ["list"],
        [
          "json",
          { outputFile: "../../.runtime/acceptance/browser-results.json" },
        ],
      ]
    : "list",
  use: {
    baseURL: process.env.E2E_URL ?? "http://localhost:5080",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
