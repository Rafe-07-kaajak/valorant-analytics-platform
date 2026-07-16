import { defineConfig } from "vitest/config";

export default defineConfig({
  // The app's postcss.config.mjs uses Next.js's string-plugin shorthand,
  // which raw Vite/PostCSS (used by Vitest) can't load. Tests here don't
  // exercise CSS, so bypass config discovery instead of processing styles.
  css: {
    postcss: {
      plugins: [],
    },
  },
});
