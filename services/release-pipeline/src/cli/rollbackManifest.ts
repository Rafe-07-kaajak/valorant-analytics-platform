import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveSafePath, stableStringify } from "@repo/vlr-ingestion";
import { loadReleasePipelineConfig } from "../releaseConfig";
import { buildRollbackManifest, type RollbackReleaseRef } from "../rollbackManifest";
import { ReleaseError } from "../releaseErrors";
import type { ReleaseManifest } from "../manifest";
import { parseCliArgs, runReleaseCli } from "./cliSupport";

/** `pnpm release:rollback:manifest [-- --previous-manifest <path>]` — TASK-049 section 15. Refreshes `operations/rollback-manifest.json` inside an already-built bundle against an optional previous release's own manifest, without rebuilding the bundle. */
async function main(): Promise<void> {
  const { options } = parseCliArgs(process.argv.slice(2));
  const config = loadReleasePipelineConfig();

  const currentManifestPath = resolveSafePath(config.bundleOutputDir, "release-manifest.json");
  const currentRaw = await readFile(currentManifestPath, "utf-8").catch(() => null);
  if (!currentRaw) throw new ReleaseError("release_bundle_missing", `No release bundle found at "${config.bundleOutputDir}". Run \`pnpm release:bundle:build\` first.`);
  const current = JSON.parse(currentRaw) as ReleaseManifest;

  let previous: RollbackReleaseRef | undefined;
  const previousManifestPath = options.get("previous-manifest");
  if (previousManifestPath) {
    const previousManifest = JSON.parse(await readFile(previousManifestPath, "utf-8")) as ReleaseManifest;
    previous = { releaseVersion: previousManifest.releaseVersion, runtimePackageVersion: previousManifest.runtimePackageVersion, modelVersion: previousManifest.modelVersion, sourceFeatureDatasetVersion: previousManifest.sourceFeatureDatasetVersion, featureSchemaVersion: previousManifest.featureSchemaVersion, featureRulesVersion: previousManifest.featureRulesVersion };
  }

  const rollback = buildRollbackManifest({ releaseVersion: current.releaseVersion, runtimePackageVersion: current.runtimePackageVersion, modelVersion: current.modelVersion, sourceFeatureDatasetVersion: current.sourceFeatureDatasetVersion, featureSchemaVersion: current.featureSchemaVersion, featureRulesVersion: current.featureRulesVersion }, previous);

  const outputPath = join(config.bundleOutputDir, "operations", "rollback-manifest.json");
  await writeFile(outputPath, stableStringify(rollback), "utf-8");

  console.log(`Rollback compatible: ${rollback.rollbackCompatible}`);
  if (rollback.rollbackBlockers.length > 0) {
    console.log("Blockers:");
    for (const blocker of rollback.rollbackBlockers) console.log(`  - ${blocker}`);
  }
  console.log(`Written to: ${outputPath}`);
}

void runReleaseCli(main);
