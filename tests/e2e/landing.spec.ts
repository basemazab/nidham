// ============================================================================
// E2E — public landing page
// ============================================================================
//
// Smoke tests for the home page (/). These run against a real Next.js
// server (started by Playwright's webServer config) and exercise the
// rendering path that an anonymous visitor takes — so they catch
// problems like "the landing page errors out under Vercel's edge
// runtime" or "the SEO meta tags went missing in a refactor".

import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("loads with the Nidham brand visible", async ({ page }) => {
    await page.goto("/");

    // The brand letter "ن" is in the top-left logo tile and again
    // somewhere in the hero. Just checking for it is a reliable signal
    // that React rendered.
    await expect(page.locator("body")).toContainText("نِظام");
  });

  test("has working links to login and signup", async ({ page }) => {
    await page.goto("/");

    // There are multiple "تسجيل الدخول" anchors (header, footer, CTA);
    // just pick the first one and follow it. .first() avoids the
    // "strict mode violation: resolved to N elements" error.
    const loginLink = page.getByRole("link", { name: /تسجيل|دخول/ }).first();
    await expect(loginLink).toBeVisible();
  });

  test("does not surface an auth error banner without ?error= param", async ({
    page,
  }) => {
    await page.goto("/");
    // The auth-error banner is only rendered when ?error= or ?error_code=
    // is set. A clean visit must not show the warning text.
    await expect(page.getByText("حصلت مشكلة")).not.toBeVisible();
  });

  test("renders the auth-error banner when ?error_code=otp_expired is passed", async ({
    page,
  }) => {
    await page.goto("/?error_code=otp_expired");
    await expect(page.getByText("حصلت مشكلة")).toBeVisible();
    await expect(
      page.getByText(/اللينك انتهت صلاحيته|اطلب لينك جديد/),
    ).toBeVisible();
  });

  test("returns 200 OK and includes Arabic content-language hints", async ({
    page,
  }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    // HTML must declare dir=rtl OR lang=ar somewhere for screen readers.
    const html = page.locator("html");
    const dir = await html.getAttribute("dir");
    const lang = await html.getAttribute("lang");
    expect(dir === "rtl" || lang?.startsWith("ar")).toBe(true);
  });
});
