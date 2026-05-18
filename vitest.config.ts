// ============================================================================
// Vitest config — unit + integration tests
// ============================================================================
//
// Two separate test types live in the repo:
//
//   1) Unit tests  — co-located next to the code they test
//                    (e.g. src/lib/payroll.test.ts).
//   2) Integration tests — under tests/integration/. These mock Supabase
//                    and exercise the server actions end-to-end.
//
// E2E tests (Playwright) live under tests/e2e/ and are excluded here —
// they run via `npm run test:e2e` with a real dev server.
//
// Load tests (k6) live under tests/load/ and are excluded entirely —
// k6 is a separate binary, not a Node runner.

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "tests/integration/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: [
      "node_modules",
      ".next",
      "tests/e2e/**",
      "tests/load/**",
      "playwright-report/**",
      "test-results/**",
    ],
    // Server actions call redirect() which throws a NEXT_REDIRECT error
    // by design. Our integration tests catch that and assert against the
    // path. Don't let it fail the suite as an unhandled error.
    dangerouslyIgnoreUnhandledErrors: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      // Aim coverage at the testable pure-logic surface. Pages + UI
      // components are exercised by Playwright instead.
      include: ["src/lib/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.spec.ts",
        "src/lib/supabase/**", // thin wrappers around @supabase/ssr
        "src/lib/help-content.ts",
        "src/lib/compliance-data.ts",
      ],
    },
  },
});
