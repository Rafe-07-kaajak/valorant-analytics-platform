import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PredictionService } from "./predictionService";
import { LocalFilesystemArtifactSource } from "./artifactSource";
import { loadModelInferenceConfig } from "./config";
import { buildFixtureArtifact, ELO_FIXTURE_MODEL, LOGISTIC_FIXTURE_MODEL, FIXTURE_FEATURE_CONTRACT, fixtureValidRow } from "./testFixtures/buildFixtureArtifact";

/**
 * End-to-end lifecycle tests over the fixture artifact — TASK-046
 * requirement 25. Deliberately uses only the fixture builder, never the
 * developer's local gitignored `services/vlr-ingestion/.local/vlr-data`
 * artifact (that is reserved for the optional manual CLI smoke commands —
 * see docs/34, "Real-artifact smoke test").
 */

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    requestId: "req-1",
    featureSchemaVersion: FIXTURE_FEATURE_CONTRACT.featureSchemaVersion,
    featureRulesVersion: FIXTURE_FEATURE_CONTRACT.featureRulesVersion,
    features: fixtureValidRow(),
    ...overrides,
  };
}

describe("PredictionService integration", () => {
  it("runs the full audit -> load -> self-test -> predict -> batch -> reload lifecycle against a fixture artifact", async () => {
    const { artifactDir, rootDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, manifestOverrides: { modelVersion: "lifecycle-v1" } });
    const config = { ...loadModelInferenceConfig(), artifactDir };
    const service = new PredictionService(config, new LocalFilesystemArtifactSource(artifactDir));

    const startSnapshot = await service.start();
    expect(startSnapshot.status).toBe("ready");
    expect(startSnapshot.lastSelfTest?.passed).toBe(true);

    const prediction = await service.predict(baseRequest());
    expect(prediction.teamAWinProbability + prediction.teamBWinProbability).toBeCloseTo(1, 12);

    const repeated = await service.predict(baseRequest());
    expect(repeated.teamAWinProbability).toBe(prediction.teamAWinProbability);

    const batch = await service.predictBatch([baseRequest(), baseRequest()]);
    expect(batch.successCount).toBe(2);

    // Swap in a logistic-regression artifact (valid version change).
    await overwriteArtifact(rootDir, { model: LOGISTIC_FIXTURE_MODEL, manifestOverrides: { modelVersion: "lifecycle-v2" } });
    const reloadSnapshot = await service.reload();
    expect(reloadSnapshot.modelVersion).toBe("lifecycle-v2");
    expect(reloadSnapshot.estimatorType).toBe("logistic-regression");

    // Corrupt the artifact in place, then reload — must preserve v2.
    const { unlink } = await import("node:fs/promises");
    await unlink(join(artifactDir, "calibration.json"));
    const failedReload = await service.reload();
    expect(failedReload.modelVersion).toBe("lifecycle-v2");
    expect(failedReload.lastLoadError?.code).toBe("artifact_missing");
  });

  it("reports model_unavailable-shaped errors for a missing artifact directory rather than throwing an unhandled exception", async () => {
    const missingDir = join(process.env.TEMP ?? process.env.TMPDIR ?? "/tmp", "model-inference-missing-" + Date.now());
    const config = { ...loadModelInferenceConfig(), artifactDir: missingDir };
    const service = new PredictionService(config, new LocalFilesystemArtifactSource(missingDir));
    const snapshot = await service.start();
    expect(snapshot.status).toBe("failed");
    await expect(service.predict(baseRequest())).rejects.toMatchObject({ code: "model_not_loaded" });
  });

  it("rejects a request whose feature schema version does not match the loaded artifact (feature-contract drift)", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    const config = { ...loadModelInferenceConfig(), artifactDir };
    const service = new PredictionService(config, new LocalFilesystemArtifactSource(artifactDir));
    await service.start();
    await expect(service.predict(baseRequest({ featureSchemaVersion: "some-drifted-schema@2.0.0" }))).rejects.toMatchObject({ code: "feature_schema_mismatch" });
  });

  it("never mutates the source artifact files across repeated reads (load, self-test, predict, reload)", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    const before = await snapshotDirectory(artifactDir);

    const config = { ...loadModelInferenceConfig(), artifactDir };
    const service = new PredictionService(config, new LocalFilesystemArtifactSource(artifactDir));
    await service.start();
    await service.predict(baseRequest());
    await service.predictBatch([baseRequest(), baseRequest()]);
    await service.reload();

    const after = await snapshotDirectory(artifactDir);
    expect(after).toEqual(before);
  });

  it("never references a network API anywhere in the service source (fetch/XMLHttpRequest/http.request)", async () => {
    const moduleFiles = ["artifactSource.ts", "artifactValidator.ts", "registry.ts", "predictionService.ts", "requestSchema.ts", "responseSchema.ts", "inferenceAdapter.ts", "selfTest.ts"];
    for (const file of moduleFiles) {
      const source = await readFile(new URL(`./${file}`, import.meta.url), "utf-8");
      expect(source).not.toMatch(/fetch\(|XMLHttpRequest|http\.request|https\.request/);
    }
  });

  it("handles a cold-start-shaped row (all-default synthetic values) without throwing for the elo estimator", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    const config = { ...loadModelInferenceConfig(), artifactDir };
    const service = new PredictionService(config, new LocalFilesystemArtifactSource(artifactDir));
    await service.start();
    const coldStartRow = { teamAEloWinProbability: 0.5, teamAEloRating: 1500, teamBEloRating: 1500, teamADaysSinceLastMatch: null, teamAHasPriorMatch: false, eventFamily: "vct-americas" };
    const response = await service.predict(baseRequest({ features: coldStartRow }));
    expect(response.teamAWinProbability).toBe(0.5);
  });
});

async function overwriteArtifact(rootDir: string, options: Parameters<typeof buildFixtureArtifact>[0]): Promise<void> {
  const { MODEL_DIR_SEGMENTS } = await import("@repo/vlr-ingestion");
  const fs = await import("node:fs/promises");
  const built = await buildFixtureArtifact(options);
  const targetDir = join(rootDir, ...MODEL_DIR_SEGMENTS);
  await fs.mkdir(targetDir, { recursive: true });
  for (const fileName of await fs.readdir(built.artifactDir)) {
    const content = await fs.readFile(join(built.artifactDir, fileName), "utf-8");
    await fs.writeFile(join(targetDir, fileName), content, "utf-8");
  }
}

async function snapshotDirectory(dir: string): Promise<Record<string, string>> {
  const files = await readdir(dir);
  const snapshot: Record<string, string> = {};
  for (const file of files.sort()) snapshot[file] = await readFile(join(dir, file), "utf-8");
  return snapshot;
}
