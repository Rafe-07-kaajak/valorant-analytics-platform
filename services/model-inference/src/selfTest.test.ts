import { describe, expect, it } from "vitest";
import { runSelfTest, buildSelfTestRow } from "./selfTest";
import { toLoadedModelArtifact } from "./inferenceAdapter";
import { validateArtifact } from "./artifactValidator";
import { LocalFilesystemArtifactSource } from "./artifactSource";
import { loadModelInferenceConfig } from "./config";
import { buildFixtureArtifact, ELO_FIXTURE_MODEL, LOGISTIC_FIXTURE_MODEL, TREE_FIXTURE_MODEL, FIXTURE_FEATURE_CONTRACT } from "./testFixtures/buildFixtureArtifact";
import { InferenceError } from "./errors";

async function loadedFixtureArtifact(model: typeof ELO_FIXTURE_MODEL) {
  const { artifactDir } = await buildFixtureArtifact({ model });
  const source = new LocalFilesystemArtifactSource(artifactDir);
  const { files } = await validateArtifact(source, loadModelInferenceConfig());
  return toLoadedModelArtifact(files);
}

describe("buildSelfTestRow", () => {
  it("builds a structurally valid row entirely from the feature contract, with no dependency on the real feature dataset", () => {
    const row = buildSelfTestRow(FIXTURE_FEATURE_CONTRACT);
    for (const field of FIXTURE_FEATURE_CONTRACT.numericFields) expect(row[field]).toBe(0);
    for (const field of FIXTURE_FEATURE_CONTRACT.booleanFields) expect(row[field]).toBe(false);
    expect(row.eventFamily).toBe(FIXTURE_FEATURE_CONTRACT.categoricalVocabulary.eventFamily![0]);
  });
});

describe("runSelfTest", () => {
  it("passes for a valid elo-baseline artifact", async () => {
    const artifact = await loadedFixtureArtifact(ELO_FIXTURE_MODEL);
    const report = runSelfTest(artifact);
    expect(report.passed).toBe(true);
    expect(report.teamAWinProbability).not.toBeNull();
    expect(report.checks.every((c) => c.passed)).toBe(true);
  });

  it("passes for a valid logistic-regression artifact", async () => {
    const artifact = await loadedFixtureArtifact(LOGISTIC_FIXTURE_MODEL);
    const report = runSelfTest(artifact);
    expect(report.passed).toBe(true);
  });

  it("passes for a valid gradient-boosted-trees artifact", async () => {
    const artifact = await loadedFixtureArtifact(TREE_FIXTURE_MODEL);
    const report = runSelfTest(artifact);
    expect(report.passed).toBe(true);
  });

  it("throws self_test_failed when the artifact cannot produce a prediction for its own contract-shaped row", async () => {
    const artifact = await loadedFixtureArtifact(ELO_FIXTURE_MODEL);
    // teamAEloWinProbability is required by the elo-baseline path specifically; strip it from the contract's own numeric fields to simulate a self-inconsistent artifact.
    const brokenArtifact = { ...artifact, featureContract: { ...artifact.featureContract, numericFields: artifact.featureContract.numericFields.filter((f) => f !== "teamAEloWinProbability") } };
    expect(() => runSelfTest(brokenArtifact)).toThrow(InferenceError);
  });

  it("produces a deterministic teamAWinProbability across two independent self-test runs", async () => {
    const artifact = await loadedFixtureArtifact(ELO_FIXTURE_MODEL);
    const first = runSelfTest(artifact);
    const second = runSelfTest(artifact);
    expect(first.teamAWinProbability).toBe(second.teamAWinProbability);
  });
});
