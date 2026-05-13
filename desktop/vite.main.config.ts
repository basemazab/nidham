import { defineConfig } from "vite";

// Build config for the Electron main process (Node.js side).
export default defineConfig({
  build: {
    rollupOptions: {
      external: ["electron", "electron-store", "electron-squirrel-startup"],
    },
  },
});
