// ============================================================================
// E2E — protected-route auth gating
// ============================================================================
//
// Anonymous visitors hitting any /dashboard route must be redirected to
// /login. This is enforced by every page's `if (!user) redirect("/login")`
// guard and by middleware. The test is the catch-net: if a refactor drops
// the guard, the test fails before the leak ships.

import { test, expect } from "@playwright/test";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/dashboard/employees",
  "/dashboard/attendance",
  "/dashboard/attendance/logs",
  "/dashboard/payroll",
  "/dashboard/customers",
];

for (const route of PROTECTED_ROUTES) {
  test(`anonymous visitor to ${route} is redirected to /login`, async ({
    page,
  }) => {
    const response = await page.goto(route);

    // Either the response itself is a 3xx (rare with App Router redirects
    // that come back as 307s to the client) OR the final URL is /login.
    // We accept both.
    const finalUrl = new URL(page.url());
    expect(finalUrl.pathname).toBe("/login");
    // 200 because we landed on /login successfully
    expect(response?.status()).toBeGreaterThanOrEqual(200);
    expect(response?.status()).toBeLessThan(400);
  });
}
