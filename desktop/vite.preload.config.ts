import { defineConfig } from "vite";

// Build config for the preload script (the safe bridge between renderer
// and main). Runs in a context that has access to both Node and DOM.
export default defineConfig({
  build: {
    rollupOptions: {
      external: ["electron"],
    },
  },
});
