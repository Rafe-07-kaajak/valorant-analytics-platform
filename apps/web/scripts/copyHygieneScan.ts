import { resolve } from "node:path";
import { scanCopyHygiene } from "../src/server/copyHygiene/scanCopyHygiene";

/**
 * `pnpm copy-hygiene` (this package) / `pnpm copy-hygiene` (root) — TASK-050
 * section 15. Fails (non-zero exit) if any em dash (U+2014) or en dash
 * (U+2013) is found in web-facing TypeScript/TSX source. Safe to run in CI:
 * no network access, no build step, reads the repo tree only.
 */
function main(): void {
  const repoRoot = resolve(__dirname, "../../..");
  const report = scanCopyHygiene(repoRoot);

  console.log(`Copy hygiene scan: ${report.filesScanned} files checked.`);

  if (report.violations.length === 0) {
    console.log("PASSED — no em dash or en dash found in web-facing copy.");
    return;
  }

  console.log("");
  for (const violation of report.violations) {
    console.log(`${violation.file}:${violation.line}:${violation.column}  ${violation.character}`);
    console.log(`  ${violation.excerpt}`);
  }
  console.log("");
  console.log(`FAILED — ${report.violations.length} violation(s) found.`);
  process.exitCode = 1;
}

main();
