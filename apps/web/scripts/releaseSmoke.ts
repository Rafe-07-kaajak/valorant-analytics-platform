import { runReleaseSmokeChecks } from "../src/server/release/releaseSmokeChecks";

/**
 * `pnpm release:smoke:local` (root) / `pnpm release:smoke` (this package)
 * — TASK-049 section 17. In-process post-deployment smoke test: imports
 * `apps/web`'s own server modules directly, starts no HTTP server, makes
 * no network request. Reads whatever `REAL_PREDICTION_*` /
 * `MODEL_INFERENCE_*` environment is already configured in the process —
 * pass `--expect-model-version <v>` / `--expect-runtime-package-version <v>`
 * to additionally pin expected versions (e.g. against a release manifest).
 */
function parseArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const report = await runReleaseSmokeChecks({
    expectedModelVersion: parseArg("expect-model-version"),
    expectedRuntimePackageVersion: parseArg("expect-runtime-package-version"),
  });

  for (const check of report.checks) {
    console.log(`${check.passed ? "OK  " : "FAIL"} ${check.id}: ${check.message}`);
  }
  console.log("");
  console.log(report.passed ? "Smoke checks PASSED." : "Smoke checks FAILED.");
  if (!report.passed) process.exitCode = 6;
}

main().catch((error) => {
  console.error("Release smoke check crashed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
