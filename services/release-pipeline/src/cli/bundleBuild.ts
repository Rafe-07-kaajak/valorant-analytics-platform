import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { buildFixtureReleaseInputs } from "../testFixtures/buildFixtureReleaseInputs";
import { loadReleasePipelineConfig } from "../releaseConfig";
import { buildReleaseBundle } from "../bundleBuilder";
import type { RollbackReleaseRef } from "../rollbackManifest";
import type { ReleaseManifest } from "../manifest";
import { parseCliArgs, runReleaseCli } from "./cliSupport";

/**
 * `pnpm release:bundle:build` — TASK-049 section 10. Consumes an
 * already-built runtime package (never rebuilds one) and stages a release
 * bundle. `--fixture` builds entirely against fixture inputs (a fixture
 * runtime package + a fixture app source tree, both generated on the fly)
 * — used by CI and for a fast local smoke test, never touching real data.
 * `--previous-manifest <path>` points at a prior build's own
 * `release-manifest.json` (e.g. a copy saved before rebuilding), used to
 * populate the rollback manifest's compatibility fields.
 */
async function main(): Promise<void> {
  const { flags, options } = parseCliArgs(process.argv.slice(2));

  if (flags.has("fixture")) {
    const fixture = await buildFixtureReleaseInputs();
    const result = await buildReleaseBundle({ config: fixture.config });
    console.log(`[fixture] Release version: ${result.manifest.releaseVersion}`);
    console.log(`[fixture] Bundle written to: ${result.outputDir}`);
    return;
  }

  const config = loadReleasePipelineConfig();
  const preflightReportPath = join(dirname(config.bundleOutputDir), "preflight-report.json");

  let previousRelease: RollbackReleaseRef | undefined;
  const previousManifestPath = options.get("previous-manifest");
  if (previousManifestPath) {
    const previousManifest = JSON.parse(await readFile(previousManifestPath, "utf-8")) as ReleaseManifest;
    previousRelease = { releaseVersion: previousManifest.releaseVersion, runtimePackageVersion: previousManifest.runtimePackageVersion, modelVersion: previousManifest.modelVersion, sourceFeatureDatasetVersion: previousManifest.sourceFeatureDatasetVersion, featureSchemaVersion: previousManifest.featureSchemaVersion, featureRulesVersion: previousManifest.featureRulesVersion };
  }

  const result = await buildReleaseBundle({ config, preflightReportPath: existsSync(preflightReportPath) ? preflightReportPath : undefined, previousRelease });

  console.log(`Release version: ${result.manifest.releaseVersion}`);
  console.log(`Runtime package version: ${result.manifest.runtimePackageVersion}`);
  console.log(`Model version: ${result.manifest.modelVersion} (${result.manifest.estimatorType})`);
  console.log(`Source commit: ${result.manifest.sourceCommitSha ?? "(unavailable)"}`);
  console.log(`Size summary (bytes): ${JSON.stringify(result.manifest.sizeSummaryBytes)}`);
  console.log(`Bundle written to: ${result.outputDir}`);
}

void runReleaseCli(main);
