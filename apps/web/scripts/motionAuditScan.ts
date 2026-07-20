import { resolve } from "node:path";
import { scanMotionPerformance } from "../src/server/motionAudit/scanMotionPerformance";

/**
 * `pnpm motion-audit` (this package) / `pnpm motion-audit` (root) —
 * TASK-051 section 16. Fails (non-zero exit) if any file in the new motion
 * module trips one of the small set of performance/reduced-motion rules in
 * scanMotionPerformance.ts. Safe to run in CI: no network access, no build
 * step, reads the repo tree only.
 */
function main(): void {
  const repoRoot = resolve(__dirname, "../../..");
  const report = scanMotionPerformance(repoRoot);

  console.log(`Motion performance audit: ${report.filesScanned} files checked.`);

  if (report.violations.length === 0) {
    console.log("PASSED — no violations found.");
    return;
  }

  console.log("");
  for (const violation of report.violations) {
    console.log(`${violation.file}  [${violation.rule}]`);
    console.log(`  ${violation.detail}`);
  }
  console.log("");
  console.log(`FAILED — ${report.violations.length} violation(s) found.`);
  process.exitCode = 1;
}

main();
