// ============================================================================
// Playwright config — E2E browser tests
// ============================================================================
//
// Tests live under tests/e2e/. We start the Next.js dev server before
// the suite and tear it down after. Set PLAYWRIGHT_BASE_URL to point
// at a deployed environment (e.g. staging) instead.

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // CI runs are isolated; locally we keep retries off so flake is loud.
  retries: process.env.CI ? 2 : 0,
  // Three browsers in CI; just Chromium locally for speed.
  workers: process.env.CI ? 1 : undefined,
  fullyParallel: true,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: BASE_URL,
    // Trace on first retry only — full trace on every run is gigabytes.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "ar-EG",
  },
  // Only spin up the dev server if we're hitting localhost. When
  // PLAYWRIGHT_BASE_URL is set (staging / preview deployment), skip.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        // Next.js cold-start can take 30s+, especially on a fresh CI box.
        timeout: 120_000,
      },
  projects: process.env.CI
    ? [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
        { name: "webkit", use: { ...devices["Desktop Safari"] } },
      ]
    : [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
