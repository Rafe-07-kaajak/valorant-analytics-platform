import globals from "globals";
import { config as baseConfig } from "./base.mjs";

/** @type {import('eslint').Linter.Config[]} */
export const config = [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];
