import { loadReleasePipelineConfig } from "../releaseConfig";
import { describeCleanTarget } from "../bundleInspect";
import { cleanReleaseBundleOutput } from "../bundleBuilder";
import { parseCliArgs, runReleaseCli } from "./cliSupport";

/** `pnpm release:bundle:clean -- --dry-run` — TASK-049 section 12. Without `--dry-run`, deletes the bundle staging directory's contents. Requires the explicit non-dry-run flag before deleting anything; only ever operates on the configured bundle output directory. */
async function main(): Promise<void> {
  const { flags } = parseCliArgs(process.argv.slice(2));
  const config = loadReleasePipelineConfig();

  const target = await describeCleanTarget(config.bundleOutputDir);
  if (!target.exists) {
    console.log("No release bundle exists — nothing to clean.");
    return;
  }
  console.log(`Release bundle contains ${target.entryCount} top-level entr${target.entryCount === 1 ? "y" : "ies"}: ${target.entries.join(", ")}`);

  if (flags.has("dry-run")) {
    console.log("Dry run — nothing was deleted. Re-run without --dry-run to delete.");
    return;
  }

  await cleanReleaseBundleOutput(config.bundleOutputDir);
  console.log("Release bundle deleted.");
}

void runReleaseCli(main);
