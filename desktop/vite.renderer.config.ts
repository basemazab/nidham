import { defineConfig } from "vite";

// Build config for the renderer: the first-run setup screen that asks
// the HR user for their company's Nidham server URL. After setup, the
// main window loads the actual Nidham web app directly (no Vite needed).
export default defineConfig({});
