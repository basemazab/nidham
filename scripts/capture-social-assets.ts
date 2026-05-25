// ============================================================================
// capture-social-assets.ts
// ============================================================================
//
// One-off Playwright script that opens the five marketing pages on the
// live nidhamhr.com deployment, scrolls to the fixed-size visual frame,
// and clips a 1:1 PNG of just that frame — so Basem doesn't have to
// fight Snipping Tool zoom alignment.
//
// Outputs land in scripts/.social-assets/ as:
//   nidham-profile-pic.png   (1080x1080)
//   nidham-cover.png         (1640x859)
//   nidham-ad-pain.png       (1080x1080)
//   nidham-ad-roi.png        (1080x1080)
//   nidham-ad-compliance.png (1080x1080)
//
// Run from repo root:
//   npx tsx scripts/capture-social-assets.ts
//
// Why we clip a specific element instead of full-page screenshot:
// the page wraps the visual in instruction text + a slate background;
// the actual creative is one fixed-size <div>. element.screenshot()
// gives us pixel-perfect output at the design size without browser
// chrome, scrollbars, or the instruction box bleeding in.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// Base URL — override with env var if testing against a preview deploy.
const BASE_URL =
  process.env.NIDHAM_BASE_URL?.replace(/\/$/, "") ?? "https://nidhamhr.com";

// Output directory under scripts/ — gitignored so we don't bloat the repo
// with binary PNGs. Basem zips this folder and uploads to Drive.
const OUT_DIR = join(process.cwd(), "scripts", ".social-assets");

// The five assets to capture. selector targets the fixed-size visual
// frame inside each page; we ignore the surrounding instruction UI.
type Asset = {
  url: string;
  filename: string;
  width: number;
  height: number;
};

const ASSETS: Asset[] = [
  {
    url: "/social/profile-pic",
    filename: "nidham-profile-pic.png",
    width: 1080,
    height: 1080,
  },
  {
    url: "/social/cover",
    filename: "nidham-cover.png",
    width: 1640,
    height: 859,
  },
  {
    url: "/ads/pain",
    filename: "nidham-ad-pain.png",
    width: 1080,
    height: 1080,
  },
  {
    url: "/ads/roi",
    filename: "nidham-ad-roi.png",
    width: 1080,
    height: 1080,
  },
  {
    url: "/ads/compliance",
    filename: "nidham-ad-compliance.png",
    width: 1080,
    height: 1080,
  },
  // 4:5 vertical comparison ad — Facebook News Feed recommended format
  // for paid campaigns. Different aspect from the 1080x1080 squares so
  // it gets its own entry rather than overwriting one of them.
  {
    url: "/ads/compare",
    filename: "nidham-ad-compare.png",
    width: 1080,
    height: 1350,
  },
  // Seasonal — Eid Al-Adha 1447H / May 2026. Add new seasonal cards above
  // this comment as we run more holiday campaigns (Eid Al-Fitr, Mother's
  // Day, Black Friday, etc.).
  {
    url: "/social/eid",
    filename: "nidham-eid-post.png",
    width: 1080,
    height: 1080,
  },
  {
    url: "/social/eid-story",
    filename: "nidham-eid-story.png",
    width: 1080,
    height: 1920,
  },
];

async function main() {
  console.log(`📸 Capturing social assets from ${BASE_URL}`);
  await mkdir(OUT_DIR, { recursive: true });

  // Launch a headless Chromium at a viewport big enough to fit any of
  // the creatives without scroll. The 1080x1920 story is the tallest;
  // the 1640x859 cover is the widest. 2000x2100 covers both with breathing
  // room. waitFor({ state: "visible" }) checks whether the element is in
  // the viewport, so an undersized viewport silently fails on tall ads
  // like /ads/compare (1080x1350) even though the DOM is correct.
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 2000, height: 2100 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  for (const asset of ASSETS) {
    const url = `${BASE_URL}${asset.url}`;
    console.log(`  → ${asset.url}`);

    await page.goto(url, { waitUntil: "networkidle" });

    // The page wraps the visual in an outer scroll container; the
    // capturable frame is the first div with the exact pixel dimensions
    // we want. React serialises style={{ width: "1080px" }} as
    // `width:1080px` with NO spaces, so the selector has to match that
    // serialised form exactly — the CSS attribute selector is literal,
    // it doesn't normalise whitespace inside the matched value.
    const target = await page.locator(
      `div[style*="width:${asset.width}px"][style*="height:${asset.height}px"]`,
    ).first();
    await target.waitFor({ state: "visible", timeout: 10_000 });

    // Give fonts and gradients a beat to settle. networkidle covers
    // resource loads but the next-font subsetting can still swap mid-
    // render on first paint.
    await page.waitForTimeout(800);

    const outPath = join(OUT_DIR, asset.filename);
    await target.screenshot({ path: outPath, omitBackground: false });
    console.log(`    ✓ ${asset.filename} (${asset.width}x${asset.height})`);
  }

  await browser.close();
  console.log(`\n✅ Done. Assets saved to: ${OUT_DIR}`);
  console.log(
    `\nNext: zip the folder + upload to Drive, or run the upload script.`,
  );
}

main().catch((err) => {
  console.error("❌ Capture failed:", err);
  process.exit(1);
});
