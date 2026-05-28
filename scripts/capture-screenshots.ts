// Marketing screenshot generator.
//
// Drives a real Chromium via Playwright, logs into Nidham once, then
// visits every page in the PAGES array and takes a full-page PNG at
// both desktop (1920x1200) and mobile (390x844) viewports.
//
// Run:
//   1. Fill scripts/.env.local with NIDHAM_EMAIL / NIDHAM_PASSWORD /
//      NIDHAM_BASE_URL.
//   2. npx playwright install chromium   (once)
//   3. npm run screenshots
//
// Output:
//   public/marketing/screenshots/desktop/{name}.png
//   public/marketing/screenshots/mobile/{name}.png
//   public/marketing/index.json
//
// After running, commit + push -- Vercel hosts the PNGs as static
// assets and the manifest URL is:
//   {BASE_URL}/marketing/index.json

import { chromium, type Browser, type Page } from "playwright";
import * as fs from "fs/promises";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const BASE_URL =
  process.env.NIDHAM_BASE_URL?.replace(/\/$/, "") ??
  "https://nidhamhr.com";
const EMAIL = process.env.NIDHAM_EMAIL;
const PASSWORD = process.env.NIDHAM_PASSWORD;

if (!EMAIL || !PASSWORD) {
   
  console.error(
    "[capture] Missing NIDHAM_EMAIL or NIDHAM_PASSWORD in .env.local",
  );
  process.exit(1);
}

// ----------------------------------------------------------------------------
// Pages to capture. `pathOrResolver` is either a literal URL path or an
// async function that finds a real ID from a listing page (e.g. the
// first payroll period's UUID).
// ----------------------------------------------------------------------------
type Capture = {
  name: string;
  pathOrResolver: string | ((page: Page) => Promise<string | null>);
  /** When true, skip if the resolver returns null instead of failing. */
  optional?: boolean;
};

const PAGES: Capture[] = [
  { name: "01-overview", pathOrResolver: "/dashboard" },
  { name: "02-employees-list", pathOrResolver: "/dashboard/employees" },
  { name: "03-ai-pdf-import", pathOrResolver: "/dashboard/employees/import" },
  { name: "04-attendance-gps", pathOrResolver: "/dashboard/attendance" },
  { name: "05-payroll", pathOrResolver: "/dashboard/payroll" },
  {
    name: "06-payslip",
    pathOrResolver: async (page) => {
      // Pull the first payroll period link from the table.
      await page.goto(`${BASE_URL}/dashboard/payroll`, {
        waitUntil: "networkidle",
      });
      const href = await page
        .locator('a[href^="/dashboard/payroll/"]')
        .first()
        .getAttribute("href")
        .catch(() => null);
      return href && /\/dashboard\/payroll\/[0-9a-f-]{36}/.test(href)
        ? href
        : null;
    },
    optional: true,
  },
  { name: "07-requests", pathOrResolver: "/dashboard/requests" },
  // /dashboard/crm was renamed early in development -- the CRM lives at
  // /dashboard/customers in the current codebase.
  { name: "08-crm-pipeline", pathOrResolver: "/dashboard/customers" },
  { name: "09-jobs-ats", pathOrResolver: "/dashboard/jobs" },
  {
    name: "10-ai-cv-screening",
    pathOrResolver: async (page) => {
      // Land on a specific job's detail page (which lists candidates +
      // shows the AI screening UI).
      await page.goto(`${BASE_URL}/dashboard/jobs`, {
        waitUntil: "networkidle",
      });
      const href = await page
        .locator('a[href^="/dashboard/jobs/"]')
        .first()
        .getAttribute("href")
        .catch(() => null);
      return href && /\/dashboard\/jobs\/[0-9a-f-]{36}/.test(href)
        ? href
        : null;
    },
    optional: true,
  },
  { name: "11-bridge-analytics", pathOrResolver: "/dashboard/reports/bridge" },
  { name: "12-ai-assistant", pathOrResolver: "/dashboard/ai" },
];

const VIEWPORTS = {
  desktop: { width: 1920, height: 1200, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2 },
} as const;

const OUT_DIR = path.join("public", "marketing", "screenshots");
const STORAGE_STATE = path.join("scripts", "storageState.json");

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

// CSS injected before every screenshot: kills animations / transitions
// and hides toasts so the captures are pixel-stable.
const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
  [role="alert"],
  .toast,
  [data-sonner-toast],
  [data-pdf-hide] {
    display: none !important;
  }
`;

async function freezeAndHide(page: Page): Promise<void> {
  await page.addStyleTag({ content: FREEZE_CSS });
  // Just in case the toast/alert was rendered before our style tag.
  await page.evaluate(() => {
    document
      .querySelectorAll(
        '[role="alert"], .toast, [data-sonner-toast], [data-pdf-hide]',
      )
      .forEach((el) => el.remove());
    // Defang any "Beta" / "Dev" banners by class name convention.
    document.querySelectorAll('[class*="beta-banner"], [class*="dev-banner"]')
      .forEach((el) => el.remove());
  });
  // Soft settle so any layout-after-style-injection has time to paint.
  await page.waitForTimeout(800);
}

async function loginAndSaveState(browser: Browser): Promise<void> {
   
  console.log(`[capture] Logging in as ${EMAIL}...`);
  const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });

  // Native HTML inputs by name. Fall back to type-selector if the page
  // ever moves to a custom component.
  await page
    .fill('input[name="email"], input[type="email"]', EMAIL!)
    .catch(async () => {
      await page.fill('input[type="email"]', EMAIL!);
    });
  await page
    .fill('input[name="password"], input[type="password"]', PASSWORD!)
    .catch(async () => {
      await page.fill('input[type="password"]', PASSWORD!);
    });

  await Promise.all([
    page.waitForURL(
      (url) =>
        url.pathname.startsWith("/dashboard") || url.pathname === "/",
      { timeout: 30_000 },
    ),
    page.click('button[type="submit"]'),
  ]);

  await context.storageState({ path: STORAGE_STATE });
   
  console.log(`[capture] Session saved to ${STORAGE_STATE}`);
  await context.close();
}

type CaptureResult =
  | { ok: true; outPath: string }
  | { ok: false; reason: string };

async function captureOne(
  page: Page,
  capture: Capture,
  viewportName: "desktop" | "mobile",
): Promise<CaptureResult> {
  let targetPath: string;

  if (typeof capture.pathOrResolver === "string") {
    targetPath = capture.pathOrResolver;
  } else {
    const resolved = await capture.pathOrResolver(page);
    if (!resolved) {
      const result: CaptureResult = {
        ok: false,
        reason: "resolver returned null (likely no seed data)",
      };
      return result;
    }
    targetPath = resolved;
  }

  const url = `${BASE_URL}${targetPath}`;
   
  console.log(`  → ${viewportName} ${capture.name} → ${url}`);

  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  await freezeAndHide(page);

  const outPath = path.join(OUT_DIR, viewportName, `${capture.name}.png`);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await page.screenshot({ path: outPath, fullPage: true });
  const success: CaptureResult = { ok: true, outPath };
  return success;
}

async function run(): Promise<void> {
  await fs.mkdir(path.dirname(STORAGE_STATE), { recursive: true });
  const browser = await chromium.launch({ headless: true });

  // 1. Login + persist session
  await loginAndSaveState(browser);

  // 2. Capture at both viewports, reusing the saved session
  const manifest: {
    generated_at: string;
    base_url: string;
    screenshots: Array<{
      name: string;
      desktop_url: string | null;
      mobile_url: string | null;
      skipped?: string;
    }>;
  } = {
    generated_at: new Date().toISOString(),
    base_url: BASE_URL,
    screenshots: [],
  };

  const skipped: string[] = [];

  for (const viewportName of ["desktop", "mobile"] as const) {
     
    console.log(`\n[capture] Viewport: ${viewportName}`);
    const context = await browser.newContext({
      storageState: STORAGE_STATE,
      viewport: VIEWPORTS[viewportName],
      deviceScaleFactor: VIEWPORTS[viewportName].deviceScaleFactor,
      locale: "ar-EG",
    });
    const page = await context.newPage();

    for (const cap of PAGES) {
      const result = await captureOne(page, cap, viewportName);
      if (result.ok === true) continue;
      const reason = result.reason;
       
      console.warn(`    ⚠ ${cap.name}: ${reason}`);
      if (!cap.optional) {
        skipped.push(`${cap.name} (${reason})`);
      }
    }
    await context.close();
  }

  // 3. Build manifest from what's actually on disk
  for (const cap of PAGES) {
    const desktopRel = `marketing/screenshots/desktop/${cap.name}.png`;
    const mobileRel = `marketing/screenshots/mobile/${cap.name}.png`;
    const desktopExists = await fs
      .access(path.join("public", desktopRel))
      .then(() => true, () => false);
    const mobileExists = await fs
      .access(path.join("public", mobileRel))
      .then(() => true, () => false);
    manifest.screenshots.push({
      name: cap.name,
      desktop_url: desktopExists ? `${BASE_URL}/${desktopRel}` : null,
      mobile_url: mobileExists ? `${BASE_URL}/${mobileRel}` : null,
      skipped:
        !desktopExists && !mobileExists ? "no data / page errored" : undefined,
    });
  }

  await fs.writeFile(
    path.join("public", "marketing", "index.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  // 4. Print the URLs the user can share
   
  console.log("\n[capture] ✓ Done. URLs to share after `git push`:");
   
  console.log(`  Manifest: ${BASE_URL}/marketing/index.json`);
  for (const s of manifest.screenshots) {
    if (s.desktop_url) console.log(`  ✓ ${s.desktop_url}`);
    if (s.mobile_url) console.log(`  ✓ ${s.mobile_url}`);
    if (s.skipped) console.log(`  ✗ ${s.name}: ${s.skipped}`);
  }

  if (skipped.length > 0) {
     
    console.warn(
      `\n[capture] ⚠ ${skipped.length} required page(s) skipped:\n  ` +
        skipped.join("\n  "),
    );
  }

  await browser.close();
}

run().catch((err) => {
   
  console.error("[capture] FAILED:", err);
  process.exit(1);
});
