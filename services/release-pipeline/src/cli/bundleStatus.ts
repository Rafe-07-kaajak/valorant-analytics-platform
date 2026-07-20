import { loadReleasePipelineConfig } from "../releaseConfig";
import { getReleaseBundleStatus } from "../bundleInspect";
import { runReleaseCli } from "./cliSupport";

/** `pnpm release:bundle:status` — TASK-049 section 12. Safe summary only; never prints an absolute path or environment value. */
async function main(): Promise<void> {
  const config = loadReleasePipelineConfig();
  const status = await getReleaseBundleStatus(config.bundleOutputDir);

  if (!status.exists) {
    console.log("No release bundle has been built yet. Run `pnpm release:bundle:build` first.");
    return;
  }
  console.log(`Release version: ${status.releaseVersion}`);
  console.log(`Generated at: ${status.generatedAt}`);
  console.log(`Runtime package version: ${status.runtimePackageVersion}`);
  console.log(`Model version: ${status.modelVersion}`);
  console.log(`Source commit: ${status.sourceCommitSha ?? "(unavailable)"}`);
}

void runReleaseCli(main);
