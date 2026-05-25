// ============================================================================
// scripts/capture-pricing-screenshot.ts
// ============================================================================
//
// One-off Playwright script to snap a high-resolution screenshot of the
// live /pricing page exactly as visitors see it. Different shape from
// capture-social-assets.ts (which clips fixed-size design templates) —
// this one captures real product UI so the marketing team can use the
// actual page as ad creative.
//
// Why "exactly as visitors see it"? Basem already screenshotted the
// page on his own desktop and liked it. Re-rendering at the same width
// (1280px content max) keeps the layout he approved, but the @2x
// deviceScaleFactor gives him crisper PNG output suitable for paid ads.
//
// Run: npx tsx scripts/capture-pricing-screenshot.ts
//
// Output: scripts/.social-assets/nidham-pricing.png  (~2560 × ~varies)

import { chromium } from "playwright";
import { mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL =
  process.env.NIDHAM_BASE_URL?.replace(/\/$/, "") ?? "https://nidhamhr.com";

const OUT_DIR = join(process.cwd(), "scripts", ".social-assets");
const PUBLIC_DIR = join(process.cwd(), "public", "marketing");

async function main() {
  console.log(`📸 Capturing /pricing from ${BASE_URL}`);
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  // Desktop viewport at @2x DPR — gives a retina-quality PNG that scales
  // down beautifully for ad sizes (1080×1350, 1200×1500) without the soft
  // edges you get from upscaling a screenshot.
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/pricing`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500); // let any font-swap settle

  // Full-page screenshot — captures the hero + Beta callout + 4 plan
  // cards + comparison table + FAQ + signup CTA. Marketing can crop
  // whatever section they need from the result.
  const fullPath = join(OUT_DIR, "nidham-pricing-full.png");
  await page.screenshot({
    path: fullPath,
    fullPage: true,
    type: "png",
  });
  console.log(`  ✓ Full page → ${fullPath}`);

  // Hero+plans clip — the section Basem actually wants for the FB ad
  // (title + Beta callout + 4 tier cards). The first <section> selector
  // failed before because Next.js wraps in main, so we use a fixed
  // pixel clip from the top of the page instead. At 1280-wide viewport
  // with @2x DPR the hero+plans block is ~1100px tall before the
  // comparison table starts; clip 1200px to give a little breathing room.
  // playwright's clip uses CSS-pixel coords, output PNG is @ deviceScaleFactor.
  const heroPath = join(OUT_DIR, "nidham-pricing.png");
  await page.screenshot({
    path: heroPath,
    clip: { x: 0, y: 0, width: 1280, height: 1200 },
    type: "png",
  });
  console.log(`  ✓ Hero+plans clip → ${heroPath}  (1280×1200 @ 2x = 2560×2400)`);

  await browser.close();

  // Stage in public/ so the artifact is downloadable from
  // nidhamhr.com/marketing/nidham-pricing.png after the next deploy.
  await mkdir(PUBLIC_DIR, { recursive: true });
  await copyFile(heroPath, join(PUBLIC_DIR, "nidham-pricing.png"));
  await copyFile(fullPath, join(PUBLIC_DIR, "nidham-pricing-full.png"));
  console.log(`\n✅ Done. Published to public/marketing/nidham-pricing.png`);
}

main().catch((err) => {
  console.error("❌ Capture failed:", err);
  process.exit(1);
});
