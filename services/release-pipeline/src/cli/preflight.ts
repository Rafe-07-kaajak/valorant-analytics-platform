import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadReleasePipelineConfig } from "../releaseConfig";
import { runPreflight } from "../preflight";
import { parseCliArgs, runReleaseCli } from "./cliSupport";

/**
 * `pnpm release:preflight` — the full production preflight validator
 * (TASK-049 section 9): source, application (lint/check-types/test/build),
 * runtime package, and configuration checks. Writes a JSON report to
 * `<bundleOutputDir>/../preflight-report.json` (a sibling of the bundle
 * staging directory, not inside it) so `release:bundle:build` can thread
 * real verification results into the release manifest instead of
 * fabricating a pass.
 */
async function main(): Promise<void> {
  const { flags } = parseCliArgs(process.argv.slice(2));
  const config = loadReleasePipelineConfig();

  const report = await runPreflight({ config, skipApplicationChecks: flags.has("skip-application-checks") });

  for (const section of report.sections) {
    console.log(`[${section.passed ? "PASS" : "FAIL"}] ${section.name}`);
    for (const check of section.checks) {
      console.log(`  ${check.passed ? "OK  " : "FAIL"} ${check.id}: ${check.message}`);
    }
  }
  console.log("");
  console.log(`Preflight ${report.passed ? "PASSED" : "FAILED"} in ${report.durationMs}ms.`);

  const reportPath = join(dirname(config.bundleOutputDir), "preflight-report.json");
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`Report written to: ${reportPath}`);

  if (!report.passed) process.exitCode = 6;
}

void runReleaseCli(main);
