import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { PredictionService, type ModelInferenceConfig } from "@repo/model-inference";
import { buildFixtureArtifact, ELO_FIXTURE_MODEL } from "@repo/model-inference/testFixtures";
import { runReleaseSmokeChecks } from "./releaseSmokeChecks";
import { setModelServiceForTesting } from "../prediction/modelService";
import { resetHistoricalRepositoryCacheForTesting } from "../prediction/historicalFeatureRepository";
import { buildFixtureFeatureDataset } from "../prediction/testFixtures/buildFixtureFeatureDataset";

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

describe("runReleaseSmokeChecks", () => {
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

  it("passes every check when the model and historical dataset are both available", async () => {
    const artifact = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    tempDirs.push(artifact.rootDir);
    const service = new PredictionService(fixtureModelInferenceConfig(artifact.artifactDir));
    await service.start();
    setModelServiceForTesting(service);

    const dataset = await buildFixtureFeatureDataset();
    tempDirs.push(dataset.rootDir);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = dataset.rootDir;

    const report = await runReleaseSmokeChecks();
    expect(report.passed).toBe(true);
    expect(report.checks.find((check) => check.id === "historical_prediction_deterministic")?.passed).toBe(true);
    expect(report.checks.find((check) => check.id === "synthetic_mode_available")?.passed).toBe(true);
  });

  it("reports a safe unavailable state (never a raw path) when the historical dataset is missing", async () => {
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = "/nonexistent-directory-for-smoke-tests";

    const report = await runReleaseSmokeChecks();
    expect(report.checks.find((check) => check.id === "safe_unavailable_state")?.passed).toBe(true);
    expect(report.checks.find((check) => check.id === "historical_prediction_deterministic")?.message).toContain("Skipped");
    expect(JSON.stringify(report)).not.toContain("/nonexistent-directory-for-smoke-tests");
  });

  it("fails expected_versions_match when a pinned version does not match", async () => {
    const artifact = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    tempDirs.push(artifact.rootDir);
    const service = new PredictionService(fixtureModelInferenceConfig(artifact.artifactDir));
    await service.start();
    setModelServiceForTesting(service);

    const dataset = await buildFixtureFeatureDataset();
    tempDirs.push(dataset.rootDir);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = dataset.rootDir;

    const report = await runReleaseSmokeChecks({ expectedModelVersion: "not-the-real-version" });
    expect(report.passed).toBe(false);
    expect(report.checks.find((check) => check.id === "expected_versions_match")?.passed).toBe(false);
  });

  it("two independent runs against the same fixture data produce the same prediction result (determinism)", async () => {
    const artifact = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    tempDirs.push(artifact.rootDir);
    const service = new PredictionService(fixtureModelInferenceConfig(artifact.artifactDir));
    await service.start();
    setModelServiceForTesting(service);

    const dataset = await buildFixtureFeatureDataset();
    tempDirs.push(dataset.rootDir);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = dataset.rootDir;

    const first = await runReleaseSmokeChecks();
    const second = await runReleaseSmokeChecks();
    expect(second.checks.find((check) => check.id === "historical_prediction_deterministic")?.message).toBe(first.checks.find((check) => check.id === "historical_prediction_deterministic")?.message);
  });
});
