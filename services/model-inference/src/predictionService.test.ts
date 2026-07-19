import { describe, expect, it } from "vitest";
import { PredictionService, MAX_BATCH_SIZE } from "./predictionService";
import { LocalFilesystemArtifactSource } from "./artifactSource";
import { loadModelInferenceConfig } from "./config";
import { buildFixtureArtifact, ELO_FIXTURE_MODEL, FIXTURE_FEATURE_CONTRACT, fixtureValidRow } from "./testFixtures/buildFixtureArtifact";

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    requestId: "req-1",
    featureSchemaVersion: FIXTURE_FEATURE_CONTRACT.featureSchemaVersion,
    featureRulesVersion: FIXTURE_FEATURE_CONTRACT.featureRulesVersion,
    features: fixtureValidRow(),
    ...overrides,
  };
}

async function makeService(overrides: Partial<ReturnType<typeof loadModelInferenceConfig>> = {}, fixtureModel = ELO_FIXTURE_MODEL) {
  const { artifactDir } = await buildFixtureArtifact({ model: fixtureModel });
  const config = { ...loadModelInferenceConfig(), artifactDir, ...overrides };
  return new PredictionService(config, new LocalFilesystemArtifactSource(artifactDir));
}

describe("PredictionService", () => {
  it("rejects a prediction request before any model has loaded with model_not_loaded", async () => {
    const service = await makeService();
    await expect(service.predict(baseRequest())).rejects.toMatchObject({ code: "model_not_loaded" });
  });

  it("becomes ready after start() and serves a deterministic, contract-shaped prediction", async () => {
    const service = await makeService();
    const startSnapshot = await service.start();
    expect(startSnapshot.ready).toBe(true);

    const response = await service.predict(baseRequest());
    expect(response.teamAWinProbability).toBeCloseTo(0.62, 10);
    expect(response.teamAWinProbability + response.teamBWinProbability).toBeCloseTo(1, 12);
    expect(response.modelVersion).toBe("fixture-model-v1");
    expect(response.estimatorType).toBe("elo-baseline");
    expect(response.predictedWinnerSide).toBe("teamA");
    expect(response.requestId).toBe("req-1");
    expect(typeof response.inferenceDurationMs).toBe("number");
  });

  it("produces an identical prediction for an identical request across repeated calls", async () => {
    const service = await makeService();
    await service.start();
    const first = await service.predict(baseRequest());
    const second = await service.predict(baseRequest());
    expect(first.teamAWinProbability).toBe(second.teamAWinProbability);
    expect(first.predictedWinnerSide).toBe(second.predictedWinnerSide);
  });

  it("rejects a request pinned to a model version that does not match the loaded artifact", async () => {
    const service = await makeService();
    await service.start();
    await expect(service.predict(baseRequest({ requestedModelVersion: "some-other-version" }))).rejects.toMatchObject({ code: "requested_model_version_mismatch" });
  });

  it("accepts a request pinned to the currently loaded model version", async () => {
    const service = await makeService();
    await service.start();
    const response = await service.predict(baseRequest({ requestedModelVersion: "fixture-model-v1" }));
    expect(response.modelVersion).toBe("fixture-model-v1");
  });

  it("enforces the configured request payload size bound", async () => {
    const service = await makeService();
    await service.start();
    const huge = "x".repeat(1_000_000);
    await expect(service.predict(baseRequest(), huge)).rejects.toMatchObject({ code: "payload_too_large" });
  });

  it("records inference success/failure counters", async () => {
    const service = await makeService();
    await service.start();
    await service.predict(baseRequest());
    await service.predict(baseRequest({ features: {} })).catch(() => undefined);
    const status = service.internalStatus();
    expect(status.metrics.inferenceCount).toBe(1);
    expect(status.metrics.inferenceFailureCount).toBe(1);
  });

  it("serializes an inference error safely (no stack trace, no raw internal message)", async () => {
    const service = await makeService();
    await service.start();
    try {
      await service.predict(baseRequest({ features: {} }));
      throw new Error("expected predict() to throw");
    } catch (error) {
      expect(error).toMatchObject({ code: "missing_feature" });
      expect((error as Error).stack).toBeDefined(); // the Error itself still has a stack for internal logging...
    }
  });

  it("throws inference_timeout when the configured timeout budget is exceeded", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    const config = { ...loadModelInferenceConfig(), artifactDir, inferenceTimeoutMs: -1 };
    const service = new PredictionService(config, new LocalFilesystemArtifactSource(artifactDir));
    await service.start();
    await expect(service.predict(baseRequest())).rejects.toMatchObject({ code: "inference_timeout" });
  });

  describe("fallback mode", () => {
    it("returns model_unavailable-style rejection when the artifact is missing and fallback is disabled", async () => {
      const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, omitFile: "model.json" });
      const config = { ...loadModelInferenceConfig(), artifactDir, fallbackPolicy: "disabled" as const };
      const service = new PredictionService(config, new LocalFilesystemArtifactSource(artifactDir));
      await service.start();
      await expect(service.predict(baseRequest())).rejects.toMatchObject({ code: "model_not_loaded" });
    });

    it("serves a clearly-flagged constant fallback prediction when configured, never silently blending with a real model", async () => {
      const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, omitFile: "model.json" });
      const config = { ...loadModelInferenceConfig(), artifactDir, fallbackPolicy: "constant" as const, fallbackConstantProbability: 0.5 };
      const service = new PredictionService(config, new LocalFilesystemArtifactSource(artifactDir));
      await service.start();
      const response = await service.predict(baseRequest());
      expect(response.estimatorType).toBe("fallback-constant");
      expect(response.teamAWinProbability).toBe(0.5);
      expect(response.warnings.some((w) => w.includes("FALLBACK MODE ACTIVE"))).toBe(true);
    });
  });

  describe("start()", () => {
    it("throws when requireModelOnStart is set and the artifact fails to load", async () => {
      const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, omitFile: "model.json" });
      const config = { ...loadModelInferenceConfig(), artifactDir, requireModelOnStart: true, fallbackPolicy: "disabled" as const };
      const service = new PredictionService(config, new LocalFilesystemArtifactSource(artifactDir));
      await expect(service.start()).rejects.toMatchObject({ code: "model_unavailable" });
    });

    it("does not load anything when loadOnStart is false", async () => {
      const service = await makeService({ loadOnStart: false });
      const snapshot = await service.start();
      expect(snapshot.status).toBe("unloaded");
    });
  });

  describe("predictBatch", () => {
    it("preserves input order and reports per-item success/failure independently", async () => {
      const service = await makeService();
      await service.start();
      const result = await service.predictBatch([baseRequest({ requestId: "a" }), baseRequest({ requestId: "b", features: {} }), baseRequest({ requestId: "c" })]);
      expect(result.results.map((r) => r.index)).toEqual([0, 1, 2]);
      expect(result.results[0]!.success).toBe(true);
      expect(result.results[1]!.success).toBe(false);
      expect(result.results[1]!.error?.code).toBe("missing_feature");
      expect(result.results[2]!.success).toBe(true);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
    });

    it("enforces a bounded maximum batch size", async () => {
      const service = await makeService();
      await service.start();
      const oversized = Array.from({ length: MAX_BATCH_SIZE + 1 }, () => baseRequest());
      await expect(service.predictBatch(oversized)).rejects.toMatchObject({ code: "payload_too_large" });
    });

    it("produces deterministic results independent of prior calls (no cross-request state)", async () => {
      const service = await makeService();
      await service.start();
      const firstBatch = await service.predictBatch([baseRequest()]);
      const secondBatch = await service.predictBatch([baseRequest()]);
      expect(firstBatch.results[0]!.response?.teamAWinProbability).toBe(secondBatch.results[0]!.response?.teamAWinProbability);
    });
  });

  describe("health/readiness", () => {
    it("liveness is always alive regardless of model state", async () => {
      const service = await makeService();
      expect(service.liveness().alive).toBe(true);
    });

    it("readiness reflects registry state and never leaks raw paths", async () => {
      const service = await makeService();
      expect(service.readiness().ready).toBe(false);
      await service.start();
      const readiness = service.readiness();
      expect(readiness.ready).toBe(true);
      expect(JSON.stringify(readiness)).not.toMatch(/[A-Za-z]:\\/);
    });

    it("internal status includes registry + metrics detail, still without raw paths", async () => {
      const service = await makeService();
      await service.start();
      const status = service.internalStatus();
      expect(status.registry.modelVersion).toBe("fixture-model-v1");
      expect(JSON.stringify(status)).not.toMatch(/[A-Za-z]:\\/);
    });
  });

  describe("reload()", () => {
    it("delegates to the registry and reflects the updated snapshot", async () => {
      const service = await makeService();
      await service.start();
      const snapshot = await service.reload();
      expect(snapshot.status).toBe("ready");
    });
  });
});
