import { writeFile } from "node:fs/promises";
import { PredictionService } from "../predictionService";
import { LocalFilesystemArtifactSource } from "../artifactSource";
import { loadModelInferenceConfig } from "../config";
import { loadRuntimePackage } from "../runtimePackage/loader";
import { loadRuntimePackageBuildConfig } from "../runtimePackage/config";
import { RuntimePackageError } from "../runtimePackage/runtimePackageErrors";
import { runRuntimePackageCli } from "./runtimePackageCliSupport";
import { localReportPath } from "./localReportDir";

/**
 * `pnpm runtime:package:smoke` — TASK-048. Loads the currently built runtime
 * package exactly the way `apps/web` would (via `loadRuntimePackage` +
 * `LocalFilesystemArtifactSource` pointed at `<package>/model`), runs one
 * real prediction against the first packaged historical row, repeats it to
 * confirm determinism, and persists a JSON report. This is the manual
 * "runtime smoke test" — distinct from the fixture-based automated tests.
 */
async function main(): Promise<void> {
  const buildConfig = loadRuntimePackageBuildConfig();
  const loaded = await loadRuntimePackage(buildConfig.outputDir, { maxFileBytes: buildConfig.maxFileBytes });

  const service = new PredictionService(loadModelInferenceConfig(), new LocalFilesystemArtifactSource(loaded.modelDir));
  const snapshot = await service.start();
  if (!snapshot.ready) {
    throw new RuntimePackageError("runtime_package_build_failed", `Packaged model failed to load (registry status: "${snapshot.status}").`);
  }

  const artifact = service.registry.getCurrentArtifact();
  if (!artifact) {
    throw new RuntimePackageError("runtime_package_build_failed", "Packaged model loaded but no artifact is available.");
  }

  if (loaded.historicalRows.length === 0) {
    throw new RuntimePackageError("runtime_package_row_count_mismatch", "Packaged historical dataset has zero rows; cannot run a smoke prediction.");
  }

  const sampleRow = loaded.historicalRows[0];
  const features: Record<string, unknown> = {};
  for (const field of artifact.featureContract.requiredInputFields) {
    if (Object.prototype.hasOwnProperty.call(sampleRow, field)) features[field] = sampleRow[field];
  }

  const request = {
    matchInternalId: sampleRow.matchInternalId,
    featureSchemaVersion: sampleRow.featureSchemaVersion,
    featureRulesVersion: sampleRow.featureRulesVersion,
    features,
  };

  const first = await service.predict(request);
  const second = await service.predict(request);
  const deterministic = first.teamAWinProbability === second.teamAWinProbability;

  const report = {
    generatedAt: new Date().toISOString(),
    runtimePackageVersion: loaded.manifest.runtimePackageVersion,
    modelVersion: first.modelVersion,
    estimatorType: first.estimatorType,
    sampleMatchInternalId: sampleRow.matchInternalId,
    teamAWinProbability: first.teamAWinProbability,
    deterministic,
    historicalRowCount: loaded.historicalRows.length,
    catalogCount: loaded.historicalIndex.length,
  };

  const reportPath = await localReportPath("runtime-package-smoke.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");

  console.log(`Runtime package version: ${report.runtimePackageVersion}`);
  console.log(`Model version: ${report.modelVersion} (${report.estimatorType})`);
  console.log(`Sample prediction for ${report.sampleMatchInternalId}: teamAWinProbability=${report.teamAWinProbability}`);
  console.log(`Deterministic repeat prediction: ${deterministic}`);
  console.log(`Historical rows: ${report.historicalRowCount}, catalog entries: ${report.catalogCount}`);
  console.log(`Full report written to: ${reportPath}`);

  if (!deterministic) process.exitCode = 3;
}

void runRuntimePackageCli(main);
