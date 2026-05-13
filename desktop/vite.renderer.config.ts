import { defineConfig } from "vite";

// Build config for the renderer (the first-run setup screen). We keep
// the conventional electron-forge layout: index.html at the project
// root, with stylesheet + script referenced under ./src/renderer/.
// That way electron-forge's plugin-vite can resolve build.outDir to
// .vite/renderer/setup_window automatically without us fighting the
// root, and the production asar gets the right HTML.
export default defineConfig({});
