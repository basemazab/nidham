import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const config: ForgeConfig = {
  packagerConfig: {
    name: "Nidham",
    executableName: "Nidham",
    icon: "./assets/icon", // forge appends .ico on Win, .icns on Mac
    appBundleId: "com.nidham.desktop",
    appCategoryType: "public.app-category.business",
    asar: true,
    extraResource: ["./assets"],
  },

  rebuildConfig: {},

  makers: [
    new MakerSquirrel({
      name: "Nidham",
      authors: "Basem Azab",
      description: "Nidham HR + CRM + AI Recruitment",
      // Setup.exe icon (shown in Programs & Features)
      setupIcon: "./assets/icon.ico",
      // Icon embedded in the .exe itself
      iconUrl:
        "https://raw.githubusercontent.com/basemazab/nidham/main/desktop/assets/icon.ico",
    }),
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
