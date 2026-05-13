import { defineConfig } from "vite";
import path from "node:path";

// Build config for the renderer: the first-run setup screen that asks
// the HR user for their company's Nidham server URL. After setup, the
// main window loads the actual Nidham web app directly (no Vite needed).
//
// `root` tells Vite that index.html lives in src/renderer/, not the
// project root. Without this, the dev server returns the project's
// own package.json directory and the window opens to an empty body.
export default defineConfig({
  root: path.resolve(__dirname, "src/renderer"),
});
