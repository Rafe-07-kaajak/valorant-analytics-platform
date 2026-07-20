import { buildFixtureReleaseInputs } from "../testFixtures/buildFixtureReleaseInputs";
import { loadReleasePipelineConfig } from "../releaseConfig";
import { buildReleaseBundle } from "../bundleBuilder";
import { validateReleaseBundle } from "../bundleValidator";
import { parseCliArgs, runReleaseCli } from "./cliSupport";

/** `pnpm release:bundle:validate` — TASK-049 section 11. Re-validates an already-built bundle purely from disk. `--deep` additionally re-fingerprints the live application source tree and compares it to the bundle's recorded fingerprint. `--fixture` builds a fresh fixture bundle and validates it in one self-contained step (used by CI, which has no real bundle to point at). */
async function main(): Promise<void> {
  const { flags } = parseCliArgs(process.argv.slice(2));

  if (flags.has("fixture")) {
    const fixture = await buildFixtureReleaseInputs();
    await buildReleaseBundle({ config: fixture.config });
    const result = await validateReleaseBundle(fixture.config.bundleOutputDir);
    console.log(`[fixture] Security findings: ${result.securityFindings.length}`);
    for (const error of result.errors) console.log(`  FAIL: ${error}`);
    console.log(result.valid ? "[fixture] Bundle is VALID." : "[fixture] Bundle is INVALID.");
    if (!result.valid) process.exitCode = 3;
    return;
  }

  const config = loadReleasePipelineConfig();
  const result = await validateReleaseBundle(config.bundleOutputDir, flags.has("deep") ? { appSourceDir: config.appSourceDir } : {});

  if (result.manifest) console.log(`Release version: ${result.manifest.releaseVersion}`);
  console.log(`Security findings: ${result.securityFindings.length}`);
  for (const error of result.errors) console.log(`  FAIL: ${error}`);
  console.log(result.valid ? "Bundle is VALID." : "Bundle is INVALID.");

  if (!result.valid) process.exitCode = 3;
}

void runReleaseCli(main);
