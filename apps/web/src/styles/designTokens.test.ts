import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * TASK-050 — static coverage checks for the design-token foundation.
 * Asserts token *presence and shape* by reading the authored CSS directly
 * (there's no runtime DOM to query for `@theme`/custom-property
 * declarations outside a real browser), not visual output — this is a
 * regression guard against a token silently disappearing or a theme block
 * losing parity with its counterpart, not a pixel-level check.
 */

const STYLES_DIR = join(__dirname);
const tokensCss = readFileSync(join(STYLES_DIR, "tokens.css"), "utf8");
const typographyCss = readFileSync(join(STYLES_DIR, "typography.css"), "utf8");
const gradientsCss = readFileSync(join(STYLES_DIR, "gradients.css"), "utf8");

function darkThemeBlocks(css: string): string[] {
  const explicit = css.split('[data-theme="dark"] {')[1]?.split(/\n}\n/)[0] ?? "";
  const systemPreference = css.split("@media (prefers-color-scheme: dark)")[1] ?? "";
  return [explicit, systemPreference];
}

describe("tokens.css — color system", () => {
  it("declares the semantic status color set (success/warning/danger/info/neutral)", () => {
    for (const token of ["--success", "--warning", "--danger", "--info", "--neutral"]) {
      expect(tokensCss).toContain(`${token}:`);
    }
  });

  it("declares all four VCT region identity tokens, primary and alt", () => {
    for (const region of ["americas", "emea", "pacific", "china"]) {
      expect(tokensCss).toContain(`--region-${region}:`);
      expect(tokensCss).toContain(`--region-${region}-alt:`);
    }
  });

  it("declares a badge background/text pair for every semantic and region tone", () => {
    for (const tone of ["success", "danger", "brand", "info", "neutral"]) {
      expect(tokensCss).toContain(`--badge-${tone}-bg:`);
      expect(tokensCss).toContain(`--badge-${tone}-text:`);
    }
    for (const region of ["americas", "emea", "pacific", "china"]) {
      expect(tokensCss).toContain(`--badge-region-${region}-bg:`);
      expect(tokensCss).toContain(`--badge-region-${region}-text:`);
    }
  });

  it("declares the accent palette additively alongside the pre-existing brand and violet tokens", () => {
    expect(tokensCss).toContain("--color-brand-500:");
    expect(tokensCss).toContain("--color-accent-violet:");
    for (const accent of ["cyan", "blue", "magenta", "coral", "amber", "lime"]) {
      expect(tokensCss).toContain(`--color-accent-${accent}:`);
    }
  });

  it("registers every new theme-swapped color in the @theme inline block so Tailwind generates utilities for it", () => {
    const themeInline = tokensCss.split("@theme inline {")[1] ?? "";
    for (const token of ["--color-info", "--color-neutral", "--color-region-americas", "--color-surface-raised"]) {
      expect(themeInline).toContain(`${token}:`);
    }
  });

  it("keeps dark-theme token coverage in parity across the explicit toggle and system-preference blocks", () => {
    const [explicit, systemPreference] = darkThemeBlocks(tokensCss);
    for (const token of ["--info", "--neutral", "--region-americas", "--region-emea", "--region-pacific", "--region-china"]) {
      expect(explicit).toContain(`${token}:`);
      expect(systemPreference).toContain(`${token}:`);
    }
  });

  it("declares restrained glow/border/shadow tokens without touching pre-existing shadow-sm/md/lg", () => {
    expect(tokensCss).toContain("--shadow-sm:");
    expect(tokensCss).toContain("--shadow-md:");
    expect(tokensCss).toContain("--shadow-lg:");
    for (const token of ["--glow-cyan", "--glow-violet", "--glow-coral", "--glow-focus", "--glow-selected", "--border-hairline"]) {
      expect(tokensCss).toContain(`${token}:`);
    }
  });

  it("leaves the pre-existing brand and status token values untouched (no unreviewed repaint of existing pages)", () => {
    expect(tokensCss).toContain("--color-brand-500: #0369a1;");
    expect(tokensCss).toContain("--success: #15803d;");
    expect(tokensCss).toContain("--team-a: #0891b2;");
  });
});

describe("typography.css — type system", () => {
  it("maps --font-body and --font-display to distinct next/font variables", () => {
    expect(typographyCss).toContain("--font-body: var(--font-inter)");
    expect(typographyCss).toContain("--font-display: var(--font-space-grotesk)");
  });

  it("keeps --font-mono on Geist Mono for tabular/technical numerals", () => {
    expect(typographyCss).toContain("--font-mono: var(--font-geist-mono)");
  });

  it("declares the full named type scale", () => {
    for (const step of [
      "display-xl",
      "display-lg",
      "heading-xl",
      "heading-lg",
      "heading-md",
      "body-lg",
      "body-md",
      "body-sm",
      "label-md",
      "label-sm",
      "caption",
    ]) {
      expect(typographyCss).toContain(`--text-${step}:`);
    }
  });

  it("routes headings through --font-display, not --font-body", () => {
    const headingRule = typographyCss.split("h1,\nh2,\nh3,\nh4 {")[1]?.split("}")[0] ?? "";
    expect(headingRule).toContain("font-family: var(--font-display);");
  });
});

describe("gradients.css — gradient tokens", () => {
  it("declares the requested two-hue, region, and utility gradients", () => {
    for (const token of [
      "--gradient-cyan-blue",
      "--gradient-blue-violet",
      "--gradient-violet-magenta",
      "--gradient-coral-amber",
      "--gradient-region-americas",
      "--gradient-region-emea",
      "--gradient-region-pacific",
      "--gradient-region-china",
      "--gradient-button",
      "--gradient-selected",
      "--gradient-mesh-subtle",
      "--gradient-spotlight",
      "--gradient-ambient",
    ]) {
      expect(gradientsCss).toContain(`${token}:`);
    }
  });

  it("gives dark theme its own --gradient-ambient override", () => {
    const darkBlock = gradientsCss.split('[data-theme="dark"] {')[1] ?? "";
    expect(darkBlock).toContain("--gradient-ambient:");
  });
});
