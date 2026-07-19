import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { PredictionService, type ModelInferenceConfig } from "@repo/model-inference";
import { buildFixtureArtifact, ELO_FIXTURE_MODEL } from "@repo/model-inference/testFixtures";
import { setModelServiceForTesting } from "../../../../../server/prediction/modelService";
import { resetHistoricalRepositoryCacheForTesting } from "../../../../../server/prediction/historicalFeatureRepository";
import { buildFixtureFeatureDataset } from "../../../../../server/prediction/testFixtures/buildFixtureFeatureDataset";
import { GET } from "./route";

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

describe("GET /api/internal/prediction/readiness", () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    resetHistoricalRepositoryCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
  });

  afterEach(async () => {
    setModelServiceForTesting(null);
    resetHistoricalRepositoryCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
    for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true });
  });

  it("returns 200 with a readiness payload when the fixture model/data are ready", async () => {
    const artifact = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    tempDirs.push(artifact.rootDir);
    const service = new PredictionService(fixtureModelInferenceConfig(artifact.artifactDir));
    await service.start();
    setModelServiceForTesting(service);

    const dataset = await buildFixtureFeatureDataset();
    tempDirs.push(dataset.rootDir);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = dataset.rootDir;

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.realPredictionAvailable).toBe(true);
  });

  it("returns a 200 with an unavailable payload (never a crash) when the model artifact and historical data are both absent", async () => {
    const service = new PredictionService(fixtureModelInferenceConfig("/nonexistent-artifact-directory-for-tests"));
    await service.start();
    setModelServiceForTesting(service);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = "/nonexistent-directory-for-tests";

    const response = await GET();
    expect(response.status).toBe(200); // readiness itself never errors; unavailability is reported in the body
    const body = await response.json();
    expect(body.realPredictionAvailable).toBe(false);
    expect(body.historicalDataAvailable).toBe(false);
  });
});
