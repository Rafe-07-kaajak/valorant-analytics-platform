import { loadReleasePipelineConfig } from "../releaseConfig";
import { inspectReleaseBundle } from "../bundleInspect";
import { runReleaseCli } from "./cliSupport";

/** `pnpm release:bundle:inspect` — TASK-049 section 12. A deeper safe summary than `bundle:status`; still never prints an absolute path, environment value, or raw model/feature content. */
async function main(): Promise<void> {
  const config = loadReleasePipelineConfig();
  const inspection = await inspectReleaseBundle(config.bundleOutputDir);

  if (!inspection.exists) {
    console.log("No release bundle has been built yet. Run `pnpm release:bundle:build` first.");
    return;
  }
  console.log(JSON.stringify(inspection, null, 2));
}

void runReleaseCli(main);
