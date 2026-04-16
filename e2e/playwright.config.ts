import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }]],
  timeout: 30_000,

  projects: [
    {
      name: "browser",
      use: {
        ...devices["Desktop Chrome"],
        trace: "on-first-retry",
      },
    },
  ],

  webServer: {
    command: "npm run vite:dev",
    port: 5173,
    reuseExistingServer: true,
  },
});
