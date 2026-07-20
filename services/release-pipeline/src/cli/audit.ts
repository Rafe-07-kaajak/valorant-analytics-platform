import { loadReleasePipelineConfig, describeReleasePipelineConfig } from "../releaseConfig";
import { runPreflight } from "../preflight";
import { runReleaseCli } from "./cliSupport";

/**
 * `pnpm release:audit` — read-only readiness check, analogous to `pnpm
 * runtime:package:audit`. Runs the source/runtime-package/configuration
 * preflight sections only (never the expensive lint/typecheck/test/build
 * sequence — that is `pnpm release:preflight`'s job) so a developer can
 * quickly see whether a release bundle build is even worth attempting.
 * Never writes anything.
 */
async function main(): Promise<void> {
  const config = loadReleasePipelineConfig();
  console.log(describeReleasePipelineConfig(config));
  console.log("");

  const report = await runPreflight({ config, skipApplicationChecks: true });

  for (const section of report.sections) {
    console.log(`[${section.passed ? "PASS" : "FAIL"}] ${section.name}`);
    for (const check of section.checks) {
      console.log(`  ${check.passed ? "OK  " : "FAIL"} ${check.id}: ${check.message}`);
    }
  }
  console.log("");
  console.log(report.passed ? "Ready for a release bundle build." : "Not ready — see failed checks above.");
  if (!report.passed) process.exitCode = 2;
}

void runReleaseCli(main);
