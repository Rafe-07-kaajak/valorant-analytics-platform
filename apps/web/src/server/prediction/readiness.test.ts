import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { PredictionService, type ModelInferenceConfig } from "@repo/model-inference";
import { buildFixtureArtifact, ELO_FIXTURE_MODEL } from "@repo/model-inference/testFixtures";
import { getRealPredictionReadiness } from "./readiness";
import { setModelServiceForTesting } from "./modelService";
import { resetHistoricalRepositoryCacheForTesting } from "./historicalFeatureRepository";
import { buildFixtureFeatureDataset } from "./testFixtures/buildFixtureFeatureDataset";

function fixtureModelInferenceConfig(artifactDir: string): ModelInferenceConfig {
  return {
    artifactDir,
    expectedModelVersion: undefined,
    expectedFeatureSchemaVersion: undefined,
    loadOnStart: true,
    requireModelOnStart: false,
    strictHashValidation: true,
    probabilityClipEpsilon: 1e-15,
    maxRequestBytes: 262_144,
    reloadEnabled: false,
    reloadIntervalMs: undefined,
    fallbackPolicy: "disabled",
    fallbackConstantProbability: 0.5,
    inferenceTimeoutMs: 5_000,
    loggingMode: "safe",
    maxArtifactFileBytes: 10_000_000,
  };
}

describe("getRealPredictionReadiness", () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    resetHistoricalRepositoryCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
    delete process.env.REAL_PREDICTION_ENABLED;
  });

  afterEach(async () => {
    setModelServiceForTesting(null);
    resetHistoricalRepositoryCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
    delete process.env.REAL_PREDICTION_ENABLED;
    for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true });
  });

  it("reports fully available when the model is ready and the historical dataset is present", async () => {
    const artifact = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    tempDirs.push(artifact.rootDir);
    const service = new PredictionService(fixtureModelInferenceConfig(artifact.artifactDir));
    await service.start();
    setModelServiceForTesting(service);

    const dataset = await buildFixtureFeatureDataset();
    tempDirs.push(dataset.rootDir);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = dataset.rootDir;

    const readiness = await getRealPredictionReadiness();
    expect(readiness.realPredictionAvailable).toBe(true);
    expect(readiness.modelStatus).toBe("ready");
    expect(readiness.historicalDataAvailable).toBe(true);
    expect(readiness.currentModelVersion).toBe("fixture-model-v1");
    expect(readiness.retryable).toBe(false);
  });

  it("reports unavailable (never throws) when the model artifact is missing", async () => {
    const artifact = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, omitFile: "model.json" });
    tempDirs.push(artifact.rootDir);
    const service = new PredictionService(fixtureModelInferenceConfig(artifact.artifactDir));
    await service.start();
    setModelServiceForTesting(service);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = "/nonexistent-directory-for-tests";

    const readiness = await getRealPredictionReadiness();
    expect(readiness.realPredictionAvailable).toBe(false);
    expect(readiness.historicalDataAvailable).toBe(false);
    expect(readiness.retryable).toBe(true);
    expect(readiness.currentModelVersion).toBeUndefined();
  });

  it("reports unavailable and non-retryable when disabled by configuration", async () => {
    const artifact = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    tempDirs.push(artifact.rootDir);
    const service = new PredictionService(fixtureModelInferenceConfig(artifact.artifactDir));
    await service.start();
    setModelServiceForTesting(service);

    const dataset = await buildFixtureFeatureDataset();
    tempDirs.push(dataset.rootDir);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = dataset.rootDir;
    process.env.REAL_PREDICTION_ENABLED = "false";

    const readiness = await getRealPredictionReadiness();
    expect(readiness.realPredictionAvailable).toBe(false);
    expect(readiness.retryable).toBe(false);
  });

  it("never exposes a filesystem path in the readiness payload", async () => {
    const artifact = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    tempDirs.push(artifact.rootDir);
    const service = new PredictionService(fixtureModelInferenceConfig(artifact.artifactDir));
    await service.start();
    setModelServiceForTesting(service);

    const dataset = await buildFixtureFeatureDataset();
    tempDirs.push(dataset.rootDir);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = dataset.rootDir;

    const readiness = await getRealPredictionReadiness();
    expect(JSON.stringify(readiness)).not.toContain(dataset.rootDir);
    expect(JSON.stringify(readiness)).not.toContain(artifact.rootDir);
  });
});
