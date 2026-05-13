import { defineConfig } from "vite";

// Build config for the Electron main process (Node.js side).
//
// electron-forge/plugin-vite packages the main process as an SSR
// build. By default Vite SSR keeps every node_modules dependency
// external -- which leaks `require('electron-squirrel-startup')`
// straight into the asar and crashes the packaged app on launch
// ("Cannot find module"), because the asar has no node_modules at
// all.
//
// `ssr.noExternal: true` forces Vite to bundle every dep INTO
// main.js. `electron` itself stays external via rollupOptions because
// it's provided by the Electron runtime, not by our app.
export default defineConfig({
  build: {
    rollupOptions: {
      external: ["electron"],
    },
  },
  ssr: {
    noExternal: true,
  },
});
