// Generate Nidham app icons from a single SVG master.
//
// Produces:
//   assets/icon.png  - 512x512 PNG (used as the BrowserWindow icon)
//   assets/icon.ico  - multi-resolution ICO (16/32/48/64/128/256) for
//                      the Windows .exe icon and the Setup.exe installer
//
// Run once whenever the brand changes:
//   node scripts/generate-icons.mjs

import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(__dirname, "../assets");
mkdirSync(ASSETS, { recursive: true });

// ----------------------------------------------------------------------------
// Brand SVG
//
// Square gradient tile -- navy bottom-right, cyan top-left -- with the
// Arabic letter "ن" (noon) hand-traced as a vector path. We use a path
// instead of a <text> element so the result doesn't depend on librsvg
// finding a font with Arabic glyphs on the build machine.
//
// The little circle on top of the bowl is the noon's dot; rounded
// shape underneath is the bowl itself. Proportions match the landing
// page's nav logo.
// ----------------------------------------------------------------------------

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#22d3ee"/>
      <stop offset="55%"  stop-color="#0891b2"/>
      <stop offset="100%" stop-color="#0a1428"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.15"/>
      <stop offset="40%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="14"/>
      <feOffset dx="0" dy="10" result="offsetblur"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.45"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Rounded background tile -->
  <rect x="0" y="0" width="1024" height="1024" rx="220" ry="220" fill="url(#bg)"/>
  <rect x="0" y="0" width="1024" height="1024" rx="220" ry="220" fill="url(#sheen)"/>

  <!-- Subtle gold accent line, matches the website's underline detail -->
  <rect x="320" y="860" width="384" height="10" rx="5" fill="#c9a84c" opacity="0.55"/>

  <!-- The "ن" (noon) glyph, white -->
  <!-- Bowl: a thick semicircular arc opening upward -->
  <g filter="url(#soft-shadow)" fill="#ffffff">
    <path d="
      M 252 460
      Q 252 740 512 740
      Q 772 740 772 460
      L 692 460
      Q 692 660 512 660
      Q 332 660 332 460
      Z
    "/>
    <!-- Dot above the bowl -->
    <circle cx="512" cy="320" r="68"/>
  </g>
</svg>`;

// ----------------------------------------------------------------------------
// Pipeline
// ----------------------------------------------------------------------------

async function main() {
  const svgBuffer = Buffer.from(SVG);

  // 1. The big PNG that the BrowserWindow uses + macOS .icns input
  const masterPath = resolve(ASSETS, "icon.png");
  await sharp(svgBuffer).resize(512, 512).png().toFile(masterPath);
  console.log("→ wrote", masterPath);

  // 2. Multi-resolution ICO. Windows uses different sizes in different
  //    UI surfaces -- 16 for the title bar, 32 for the desktop, 256 for
  //    the installer splash. We feed png-to-ico every size at once.
  const ICO_SIZES = [16, 32, 48, 64, 128, 256];
  const pngBuffers = await Promise.all(
    ICO_SIZES.map((size) =>
      sharp(svgBuffer)
        .resize(size, size, { kernel: "lanczos3" })
        .png()
        .toBuffer(),
    ),
  );
  const icoBuffer = await pngToIco(pngBuffers);

  const icoPath = resolve(ASSETS, "icon.ico");
  writeFileSync(icoPath, icoBuffer);
  console.log("→ wrote", icoPath, `(${ICO_SIZES.length} sizes)`);

  console.log("\n✓ Done. Next: npm run make to rebuild the installer.");
}

main().catch((err) => {
  console.error("✗ Icon generation failed:", err);
  process.exit(1);
});
