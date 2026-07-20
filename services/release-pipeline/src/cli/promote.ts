import { loadReleasePipelineConfig } from "../releaseConfig";
import { promoteRelease } from "../promotion";
import { ReleaseError } from "../releaseErrors";
import { parseCliArgs, runReleaseCli } from "./cliSupport";

/** `pnpm release:promote -- --to validated|approved [--dry-run] [--operator <name>]` — TASK-049 section 14. */
async function main(): Promise<void> {
  const { flags, options } = parseCliArgs(process.argv.slice(2));
  const to = options.get("to");
  if (!to) throw new ReleaseError("release_invalid_transition", "Missing required --to <validated|approved> option.");

  const config = loadReleasePipelineConfig();
  const record = await promoteRelease({ releaseStateDir: config.releaseStateDir, bundleDir: config.bundleOutputDir, to, operator: options.get("operator"), dryRun: flags.has("dry-run") });

  console.log(`Release ${record.releaseVersion} is now: ${record.state}`);
  console.log(`History: ${record.history.map((entry) => `${entry.state}@${entry.at}`).join(" -> ")}`);
}

void runReleaseCli(main);
