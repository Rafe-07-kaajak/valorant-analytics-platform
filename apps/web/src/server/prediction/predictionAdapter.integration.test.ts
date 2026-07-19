import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { PredictionService, type ModelInferenceConfig } from "@repo/model-inference";
import { buildFixtureArtifact, ELO_FIXTURE_MODEL } from "@repo/model-inference/testFixtures";
import { predictHistoricalMatch } from "./predictionAdapter";
import { setModelServiceForTesting } from "./modelService";
import { resetHistoricalRepositoryCacheForTesting } from "./historicalFeatureRepository";
import { buildFixtureFeatureDataset, FIXTURE_HISTORICAL_ROWS } from "./testFixtures/buildFixtureFeatureDataset";

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

describe("predictHistoricalMatch (integration, fixture artifact + fixture feature dataset)", () => {
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
    for (const dir of tempDirs.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  async function setUpReadyFixture() {
    const artifact = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    tempDirs.push(artifact.rootDir);
    const service = new PredictionService(fixtureModelInferenceConfig(artifact.artifactDir));
    await service.start();
    setModelServiceForTesting(service);

    const dataset = await buildFixtureFeatureDataset();
    tempDirs.push(dataset.rootDir);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = dataset.rootDir;

    return { service };
  }

  it("produces a deterministic real-model prediction for a known historical match", async () => {
    await setUpReadyFixture();

    const result = await predictHistoricalMatch({ matchInternalId: "vlr:match:1001", requestId: "req-1" });

    expect(result.mode).toBe("historical-real-model");
    expect(result.match.matchInternalId).toBe("vlr:match:1001");
    expect(result.match.teamAProviderId).toBe("vlr:team:1");
    expect(result.estimatorType).toBe("elo-baseline");
    expect(result.teamAWinProbability).toBeCloseTo(0.62, 5);
    expect(result.teamBWinProbability).toBeCloseTo(0.38, 5);
    expect(result.predictedWinnerSide).toBe("teamA");
    expect(result.dataProvenance.generatedFromHistoricalSnapshot).toBe(true);
    expect(result.resultAvailability.actualResultRevealable).toBe(false);
    // Never present anywhere on the response.
    expect(result).not.toHaveProperty("labelTeamAWin");
    expect(JSON.stringify(result)).not.toContain("labelWinnerProviderId");
  });

  it("is deterministic across repeated calls for the same match", async () => {
    await setUpReadyFixture();
    const first = await predictHistoricalMatch({ matchInternalId: "vlr:match:1001" });
    const second = await predictHistoricalMatch({ matchInternalId: "vlr:match:1001" });
    expect(second.teamAWinProbability).toBe(first.teamAWinProbability);
    expect(second.predictedWinnerSide).toBe(first.predictedWinnerSide);
  });

  it("rejects an unknown matchInternalId with historical_match_not_found", async () => {
    await setUpReadyFixture();
    await expect(predictHistoricalMatch({ matchInternalId: "vlr:match:unknown" })).rejects.toMatchObject({ code: "historical_match_not_found" });
  });

  it("rejects a malformed matchInternalId with request_invalid before touching the repository", async () => {
    await setUpReadyFixture();
    await expect(predictHistoricalMatch({ matchInternalId: 12345 })).rejects.toMatchObject({ code: "request_invalid" });
  });

  it("reports model_unavailable when no model has been loaded, while historical data is present", async () => {
    const artifact = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, omitFile: "model.json" });
    tempDirs.push(artifact.rootDir);
    const service = new PredictionService(fixtureModelInferenceConfig(artifact.artifactDir));
    await service.start();
    setModelServiceForTesting(service);

    const dataset = await buildFixtureFeatureDataset();
    tempDirs.push(dataset.rootDir);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = dataset.rootDir;

    await expect(predictHistoricalMatch({ matchInternalId: "vlr:match:1001" })).rejects.toMatchObject({ code: "model_unavailable" });
  });

  it("reports historical_data_unavailable when the feature dataset is missing, independent of model readiness", async () => {
    const artifact = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    tempDirs.push(artifact.rootDir);
    const service = new PredictionService(fixtureModelInferenceConfig(artifact.artifactDir));
    await service.start();
    setModelServiceForTesting(service);

    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = "/nonexistent-directory-for-tests";

    await expect(predictHistoricalMatch({ matchInternalId: "vlr:match:1001" })).rejects.toMatchObject({ code: "historical_data_unavailable" });
  });

  it("rejects with model_unavailable when REAL_PREDICTION_ENABLED=false, even though model and data are both ready", async () => {
    await setUpReadyFixture();
    process.env.REAL_PREDICTION_ENABLED = "false";
    await expect(predictHistoricalMatch({ matchInternalId: "vlr:match:1001" })).rejects.toMatchObject({ code: "model_unavailable" });
  });

  it("second fixture row (different team pair/event) also predicts correctly, proving no cross-row state leakage", async () => {
    await setUpReadyFixture();
    const result = await predictHistoricalMatch({ matchInternalId: "vlr:match:1002" });
    expect(result.match.teamAProviderId).toBe("vlr:team:3");
    expect(result.match.eventFamily).toBe("masters");
  });

  it(`covers all ${FIXTURE_HISTORICAL_ROWS.length} fixture rows without error`, async () => {
    await setUpReadyFixture();
    for (const row of FIXTURE_HISTORICAL_ROWS) {
      const result = await predictHistoricalMatch({ matchInternalId: row.matchInternalId });
      expect(result.match.matchInternalId).toBe(row.matchInternalId);
    }
  });
});
