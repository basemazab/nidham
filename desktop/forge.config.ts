import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Optional icon files -- the bundle still builds and runs without them
// (the Electron default icon is used). Drop a 512x512 PNG and matching
// .ico into ./assets/ to brand the installer + window. See
// assets/README.md.
const hasPngIcon = existsSync(resolve(__dirname, "assets/icon.png"));
const hasIcoIcon = existsSync(resolve(__dirname, "assets/icon.ico"));

const squirrelOptions: ConstructorParameters<typeof MakerSquirrel>[0] = {
  name: "Nidham",
  authors: "Basem Azab",
  description: "Nidham HR + CRM + AI Recruitment",
};
if (hasIcoIcon) {
  // setupIcon -> the installer .exe icon (uses the local .ico file at
  // build time, no network needed)
  squirrelOptions.setupIcon = "./assets/icon.ico";

  // NOTE: We intentionally do NOT set `iconUrl`. Squirrel's iconUrl is
  // an HTTP URL Windows fetches AT INSTALL TIME to render the Control
  // Panel / shortcut icon. If that URL 404s (e.g. repo is private),
  // Squirrel skips the icon assignment and the desktop shortcut ends
  // up blank. Leaving iconUrl unset makes Windows fall back to the
  // icon embedded inside Nidham.exe itself (via packagerConfig.icon
  // below) which is the right behaviour for a self-contained install.
}

const config: ForgeConfig = {
  packagerConfig: {
    name: "Nidham",
    executableName: "Nidham",
    ...(hasPngIcon || hasIcoIcon ? { icon: "./assets/icon" } : {}),
    appBundleId: "com.nidham.desktop",
    appCategoryType: "public.app-category.business",
    asar: true,
    extraResource: ["./assets"],
  },

  rebuildConfig: {},

  makers: [
    new MakerSquirrel(squirrelOptions),
    new MakerZIP({}, ["darwin", "linux"]),
  ],

  plugins: [
    new AutoUnpackNativesPlugin({}),

    new VitePlugin({
      build: [
        {
          // Main process entry point
          entry: "src/main/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          // Preload script (bridge between Node + Renderer)
          entry: "src/preload/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "setup_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),

    // Electron Fuses harden the produced binary: disable Node integration
    // for ASAR, disable dev tools loading, etc. Reasonable defaults for a
    // distributed app.
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
