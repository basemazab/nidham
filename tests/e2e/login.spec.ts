// ============================================================================
// E2E — login page
// ============================================================================
//
// These tests use the LOGIN form to validate two things:
//   1) The login page renders with all required form fields.
//   2) HTML5 form validation (`required`, `type=email`, `minLength`)
//      fires correctly — we don't want to ship a regression that lets
//      empty submissions hit the action server.
//
// We deliberately don't test "submits with real credentials" here —
// that's an integration test against Supabase auth, not a UI smoke
// check, and we'd need a seeded test user. The auth flow is covered
// by the auth-redirect E2E in /tests/e2e/auth-redirect.spec.ts (TODO).

import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("renders the form fields", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByLabel("الإيميل")).toBeVisible();
    await expect(page.getByLabel("كلمة السر")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /دخول/ }).first(),
    ).toBeVisible();
  });

  test("links to forgot-password and signup", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("link", { name: /نسيتها/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /حساب جديد/ }),
    ).toBeVisible();
  });

  test("email field requires an @ — empty submit shows a validity message", async ({
    page,
  }) => {
    await page.goto("/login");

    const emailInput = page.getByLabel("الإيميل");
    await emailInput.fill("not-an-email");

    // Native HTML5 validation. The browser reports an error via the
    // validity API; we don't need to submit — `validity.valid` tells us.
    const valid = await emailInput.evaluate(
      (el) => (el as HTMLInputElement).validity.valid,
    );
    expect(valid).toBe(false);
  });

  test("password field enforces minLength=6", async ({ page }) => {
    await page.goto("/login");

    const pwdInput = page.getByLabel("كلمة السر");
    await pwdInput.fill("abc"); // too short

    const valid = await pwdInput.evaluate(
      (el) => (el as HTMLInputElement).validity.valid,
    );
    expect(valid).toBe(false);
  });

  test("surfaces the error from ?error= query param", async ({ page }) => {
    const msg = "بيانات الدخول غلط";
    await page.goto(`/login?error=${encodeURIComponent(msg)}`);
    await expect(page.getByText(msg)).toBeVisible();
  });
});
