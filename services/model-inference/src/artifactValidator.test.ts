import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadModelInferenceConfig } from "./config";
import { LocalFilesystemArtifactSource } from "./artifactSource";
import { validateArtifact } from "./artifactValidator";
import { buildFixtureArtifact, ELO_FIXTURE_MODEL, LOGISTIC_FIXTURE_MODEL, TREE_FIXTURE_MODEL } from "./testFixtures/buildFixtureArtifact";

function configWith(overrides: Partial<ReturnType<typeof loadModelInferenceConfig>> = {}) {
  return { ...loadModelInferenceConfig(), ...overrides };
}

describe("validateArtifact", () => {
  it("loads a valid elo-baseline fixture artifact", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    const source = new LocalFilesystemArtifactSource(artifactDir);
    const result = await validateArtifact(source, configWith());
    expect(result.files.manifest.estimatorType).toBe("elo-baseline");
    expect(result.warnings).toEqual([]);
  });

  it("loads a valid logistic-regression fixture artifact", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: LOGISTIC_FIXTURE_MODEL });
    const source = new LocalFilesystemArtifactSource(artifactDir);
    const result = await validateArtifact(source, configWith());
    expect(result.files.manifest.estimatorType).toBe("logistic-regression");
  });

  it("loads a valid gradient-boosted-trees fixture artifact", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: TREE_FIXTURE_MODEL });
    const source = new LocalFilesystemArtifactSource(artifactDir);
    const result = await validateArtifact(source, configWith());
    expect(result.files.manifest.estimatorType).toBe("gradient-boosted-trees");
  });

  it("throws artifact_missing when a required file is absent", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, omitFile: "model.json" });
    const source = new LocalFilesystemArtifactSource(artifactDir);
    await expect(validateArtifact(source, configWith())).rejects.toMatchObject({ code: "artifact_missing" });
  });

  it("throws artifact_hash_mismatch when strict hash validation is enabled and a file was tampered with after hashing", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, corruptModelJsonAfterHashing: true });
    const source = new LocalFilesystemArtifactSource(artifactDir);
    await expect(validateArtifact(source, configWith({ strictHashValidation: true }))).rejects.toMatchObject({ code: "artifact_hash_mismatch" });
  });

  it("does not fail on a tampered hash when strict hash validation is disabled, but records a warning", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    const source = new LocalFilesystemArtifactSource(artifactDir);
    const result = await validateArtifact(source, configWith({ strictHashValidation: false }));
    expect(result.warnings.some((w) => w.includes("Strict artifact hash validation is disabled"))).toBe(true);
  });

  it("throws unsupported_estimator for an estimator type outside the supported set", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: { estimatorType: "neural-network" } as never, manifestOverrides: { estimatorType: "neural-network" as never } });
    const source = new LocalFilesystemArtifactSource(artifactDir);
    await expect(validateArtifact(source, configWith())).rejects.toMatchObject({ code: "unsupported_estimator" });
  });

  it("throws artifact_schema_invalid when model.json and model-manifest.json disagree on estimator type", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, manifestOverrides: { estimatorType: "logistic-regression" } });
    const source = new LocalFilesystemArtifactSource(artifactDir);
    await expect(validateArtifact(source, configWith())).rejects.toMatchObject({ code: "artifact_schema_invalid" });
  });

  it("throws requested_model_version_mismatch when the loaded artifact does not match a configured expected model version", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    const source = new LocalFilesystemArtifactSource(artifactDir);
    await expect(validateArtifact(source, configWith({ expectedModelVersion: "some-other-version" }))).rejects.toMatchObject({ code: "requested_model_version_mismatch" });
  });

  it("throws artifact_schema_invalid for a non-finite number anywhere in model.json", async () => {
    // Standard JSON has no NaN/Infinity literal, so `JSON.stringify` would
    // silently coerce a NaN weight to `null` before it ever reached disk —
    // the only realistic way a *valid* JSON file ends up with a non-finite
    // number after `JSON.parse` is an out-of-range numeric literal (which
    // parses to `Infinity`), so the file is overwritten directly here to
    // simulate that on-disk corruption.
    const { artifactDir } = await buildFixtureArtifact({ model: LOGISTIC_FIXTURE_MODEL });
    await writeFile(join(artifactDir, "model.json"), '{"estimatorType":"logistic-regression","weights":[1e400],"bias":0,"featureNames":["x"],"config":{"l2Lambda":0.01,"iterations":1,"learningRate":0.01}}', "utf-8");
    const source = new LocalFilesystemArtifactSource(artifactDir);
    await expect(validateArtifact(source, configWith())).rejects.toMatchObject({ code: "artifact_schema_invalid" });
  });
});
