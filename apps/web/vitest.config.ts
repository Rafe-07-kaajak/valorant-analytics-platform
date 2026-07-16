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
  // tsconfig sets jsx: "preserve" (Next.js's own compiler handles it at
  // build/dev time); Vite's esbuild transform needs an explicit runtime
  // here instead, or it falls back to the classic transform and JSX in
  // test files fails with "React is not defined".
  esbuild: {
    jsx: "automatic",
  },
  test: {
    // Harmless for the existing plain-data tests (they don't touch next/image);
    // component tests opt into a DOM via a per-file `@vitest-environment jsdom` pragma.
    setupFiles: ["./vitest.setup.ts"],
  },
});
