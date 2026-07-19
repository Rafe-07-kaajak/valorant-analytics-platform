import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildRuntimePackage } from "@repo/model-inference";
import { buildFixtureArtifact, ELO_FIXTURE_MODEL } from "@repo/model-inference/testFixtures";
import { predictHistoricalMatch } from "./predictionAdapter";
import { setModelServiceForTesting } from "./modelService";
import { resetHistoricalRepositoryCacheForTesting } from "./historicalFeatureRepository";
import { resetRuntimePackageCacheForTesting } from "./runtimePackageSource";
import { buildFixtureFeatureDataset, FIXTURE_FEATURE_DATASET_VERSION } from "./testFixtures/buildFixtureFeatureDataset";

/**
 * TASK-048 parity test: the exact same source model artifact + source
 * feature dataset must produce an identical real-model prediction for the
 * same historical row whether served via `"local-generated"` mode (reading
 * the raw fixture directories directly, as TASK-047 always has) or via
 * `"runtime-package"` mode (reading the same data through a built,
 * hash-verified runtime package). This is the strongest guarantee that
 * packaging is a pure repackaging step — never a computation change.
 */
describe("historical prediction parity: local-generated vs. runtime-package source modes", () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    setModelServiceForTesting(null);
    resetHistoricalRepositoryCacheForTesting();
    resetRuntimePackageCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
    delete process.env.REAL_PREDICTION_SOURCE_MODE;
    delete process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR;
  });

  afterEach(async () => {
    setModelServiceForTesting(null);
    resetHistoricalRepositoryCacheForTesting();
    resetRuntimePackageCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
    delete process.env.REAL_PREDICTION_SOURCE_MODE;
    delete process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR;
    for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true });
  });

  it("produces identical predictions for the same row across both source modes", async () => {
    const artifact = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, manifestOverrides: { sourceFeatureDatasetVersion: FIXTURE_FEATURE_DATASET_VERSION } });
    tempDirs.push(artifact.rootDir);
    const dataset = await buildFixtureFeatureDataset();
    tempDirs.push(dataset.rootDir);

    // --- local-generated mode: point directly at the raw fixture directories. ---
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = dataset.rootDir;
    process.env.MODEL_INFERENCE_ARTIFACT_DIR = artifact.artifactDir;

    const localResult = await predictHistoricalMatch({ matchInternalId: "vlr:match:1001" });

    // --- runtime-package mode: package the same two directories, then read only through the package. ---
    setModelServiceForTesting(null);
    resetHistoricalRepositoryCacheForTesting();
    resetRuntimePackageCacheForTesting();
    delete process.env.MODEL_INFERENCE_ARTIFACT_DIR;

    const packageOutputDir = await mkdtemp(join(tmpdir(), "runtime-package-parity-"));
    tempDirs.push(packageOutputDir);
    await buildRuntimePackage({ outputDir: packageOutputDir, sourceModelDir: artifact.artifactDir, sourceFeatureDataDir: dataset.rootDir, maxFileBytes: 50_000_000 });

    process.env.REAL_PREDICTION_SOURCE_MODE = "runtime-package";
    process.env.REAL_PREDICTION_RUNTIME_PACKAGE_DIR = packageOutputDir;

    const packagedResult = await predictHistoricalMatch({ matchInternalId: "vlr:match:1001" });

    expect(packagedResult.teamAWinProbability).toBe(localResult.teamAWinProbability);
    expect(packagedResult.teamBWinProbability).toBe(localResult.teamBWinProbability);
    expect(packagedResult.predictedWinnerSide).toBe(localResult.predictedWinnerSide);
    expect(packagedResult.modelVersion).toBe(localResult.modelVersion);
    expect(packagedResult.estimatorType).toBe(localResult.estimatorType);
    expect(packagedResult.match).toEqual(localResult.match);
  });
});
