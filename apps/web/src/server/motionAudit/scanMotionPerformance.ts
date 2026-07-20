import { readFileSync } from "node:fs";
import { join, sep } from "node:path";

/**
 * TASK-051 section 16 — a small, targeted static audit of the new motion
 * module's own source files (not a general-purpose linter, and not a
 * repo-wide scan: the performance guardrails this checks only apply to the
 * files this task added). Each rule below is a plain substring/regex check
 * against a fixed, explicit file list, the same "small targeted audit"
 * approach `scanCopyHygiene.ts` uses for copy hygiene.
 */

const NEW_MOTION_FILES = [
  join("packages", "ui", "src", "hooks", "useMediaQuery.ts"),
  join("packages", "ui", "src", "hooks", "usePrefersReducedMotion.ts"),
  join("packages", "ui", "src", "hooks", "usePointerCapability.ts"),
  join("packages", "ui", "src", "hooks", "useViewportEntry.ts"),
  join("packages", "ui", "src", "hooks", "useScrollProgress.ts"),
  join("packages", "ui", "src", "lib", "revealVariants.ts"),
  join("packages", "ui", "src", "components", "ScrollReveal", "ScrollReveal.tsx"),
  join("packages", "ui", "src", "components", "StaggerGroup", "StaggerGroup.tsx"),
  join("packages", "ui", "src", "components", "ParallaxLayer", "ParallaxLayer.tsx"),
  join("packages", "ui", "src", "components", "StickyStory", "StickyStory.tsx"),
  join("packages", "ui", "src", "components", "TextLineReveal", "TextLineReveal.tsx"),
  join("packages", "ui", "src", "components", "ImageMaskReveal", "ImageMaskReveal.tsx"),
  join("packages", "ui", "src", "components", "AnimatedGradient", "AnimatedGradient.tsx"),
  join("packages", "ui", "src", "components", "MotionNumber", "MotionNumber.tsx"),
  join("packages", "ui", "src", "components", "ScrollProgress", "ScrollProgress.tsx"),
  join("apps", "web", "src", "components", "effects", "CardSpotlight.tsx"),
] as const;

/**
 * Files allowed to reference `window` directly, and why. Every other file
 * in the list above must never reference `window` at all — the rest of the
 * module reads capability/scroll state exclusively through these hooks (or
 * through Framer Motion's own internals), never a second direct listener.
 */
const WINDOW_ACCESS_ALLOWLIST: Record<string, string> = {
  [join("packages", "ui", "src", "hooks", "useMediaQuery.ts")]:
    "the one matchMedia subscription primitive; guarded by typeof window === \"undefined\"",
};

/**
 * How each file satisfies the reduced-motion requirement. Every file here
 * animates something, so every file must appear in exactly one bucket:
 *  - "hook": calls usePrefersReducedMotion directly and branches on it.
 *  - "motionConfig": renders a Framer `motion.*` element, which inherits
 *    instant-apply-on-reduced-motion for free from the app-wide
 *    `MotionConfig reducedMotion="user"` (MotionProvider) — see docs/39.
 *  - "globalCss": a plain CSS `@keyframes` animation, already covered by
 *    the site-wide `prefers-reduced-motion` rule in tokens.css that forces
 *    `animation-duration` to near-zero — no per-component branch needed.
 *  - "delegates": has no animation of its own; it only composes another
 *    audited file (e.g. a hook with no visual output).
 */
const REDUCED_MOTION_MECHANISM: Record<string, "hook" | "motionConfig" | "globalCss" | "delegates"> = {
  [join("packages", "ui", "src", "hooks", "useMediaQuery.ts")]: "delegates",
  [join("packages", "ui", "src", "hooks", "usePrefersReducedMotion.ts")]: "delegates",
  [join("packages", "ui", "src", "hooks", "usePointerCapability.ts")]: "delegates",
  [join("packages", "ui", "src", "hooks", "useViewportEntry.ts")]: "delegates",
  [join("packages", "ui", "src", "hooks", "useScrollProgress.ts")]: "delegates",
  [join("packages", "ui", "src", "lib", "revealVariants.ts")]: "delegates",
  [join("packages", "ui", "src", "components", "ScrollReveal", "ScrollReveal.tsx")]: "motionConfig",
  [join("packages", "ui", "src", "components", "StaggerGroup", "StaggerGroup.tsx")]: "motionConfig",
  [join("packages", "ui", "src", "components", "ParallaxLayer", "ParallaxLayer.tsx")]: "hook",
  [join("packages", "ui", "src", "components", "StickyStory", "StickyStory.tsx")]: "hook",
  [join("packages", "ui", "src", "components", "TextLineReveal", "TextLineReveal.tsx")]: "motionConfig",
  [join("packages", "ui", "src", "components", "ImageMaskReveal", "ImageMaskReveal.tsx")]: "motionConfig",
  [join("packages", "ui", "src", "components", "AnimatedGradient", "AnimatedGradient.tsx")]: "globalCss",
  [join("packages", "ui", "src", "components", "MotionNumber", "MotionNumber.tsx")]: "hook",
  [join("packages", "ui", "src", "components", "ScrollProgress", "ScrollProgress.tsx")]: "delegates",
  [join("apps", "web", "src", "components", "effects", "CardSpotlight.tsx")]: "delegates",
};

// Excludes `max-width:`/`min-width:` (and the height equivalents): these are
// CSS media-feature checks in a breakpoint query string (e.g.
// `(max-width: 768px)`), not an animated style/motion-target property.
const LAYOUT_PROPERTY_PATTERN = /(?<!max-)(?<!min-)\b(width|height|top|left|right|bottom)\s*:/;
const RAW_SCROLL_LISTENER_PATTERN = /addEventListener\(\s*["']scroll["']/;
const RAF_PATTERN = /requestAnimationFrame\(/;
const BLUR_PATTERN = /\bblur\(/;
const WINDOW_PATTERN = /\bwindow\./;

export interface MotionAuditViolation {
  file: string;
  rule: string;
  detail: string;
}

export interface MotionAuditReport {
  violations: MotionAuditViolation[];
  filesScanned: number;
}

export function scanMotionPerformance(repoRoot: string): MotionAuditReport {
  const violations: MotionAuditViolation[] = [];

  for (const relativePath of NEW_MOTION_FILES) {
    const text = readFileSync(join(repoRoot, relativePath), "utf8");
    const displayPath = relativePath.split(sep).join("/");

    if (LAYOUT_PROPERTY_PATTERN.test(text)) {
      violations.push({
        file: displayPath,
        rule: "no-layout-animation-property",
        detail: "found width/height/top/left/right/bottom used as an animated property key",
      });
    }

    if (BLUR_PATTERN.test(text)) {
      violations.push({ file: displayPath, rule: "no-unbounded-blur", detail: "found a blur() usage" });
    }

    if (RAW_SCROLL_LISTENER_PATTERN.test(text)) {
      violations.push({
        file: displayPath,
        rule: "no-raw-scroll-listener",
        detail: 'found a raw addEventListener("scroll", ...): scroll tracking must go through useScrollProgress',
      });
    }

    if (RAF_PATTERN.test(text)) {
      violations.push({
        file: displayPath,
        rule: "no-raw-raf-loop",
        detail: "found a direct requestAnimationFrame call outside Framer Motion's own internals",
      });
    }

    if (WINDOW_PATTERN.test(text) && !(relativePath in WINDOW_ACCESS_ALLOWLIST)) {
      violations.push({
        file: displayPath,
        rule: "no-direct-window-access",
        detail: "references `window` directly outside the allowlisted useMediaQuery primitive",
      });
    }

    if (!(relativePath in REDUCED_MOTION_MECHANISM)) {
      violations.push({
        file: displayPath,
        rule: "missing-reduced-motion-branch",
        detail: "not registered in REDUCED_MOTION_MECHANISM: every new motion file must document how it handles reduced motion",
      });
    }
  }

  return { violations, filesScanned: NEW_MOTION_FILES.length };
}
