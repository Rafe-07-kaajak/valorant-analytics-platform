import { describe, expect, it } from "vitest";
import { runArtifactAudit } from "./audit";
import { LocalFilesystemArtifactSource } from "./artifactSource";
import { loadModelInferenceConfig } from "./config";
import { buildFixtureArtifact, ELO_FIXTURE_MODEL } from "./testFixtures/buildFixtureArtifact";

describe("runArtifactAudit", () => {
  it("reports overallReady=true for a valid fixture artifact", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL });
    const source = new LocalFilesystemArtifactSource(artifactDir);
    const report = await runArtifactAudit(source, loadModelInferenceConfig());
    expect(report.overallReady).toBe(true);
    expect(report.criticalFilesPresent).toBe(true);
    expect(report.manifestSummary?.estimatorType).toBe("elo-baseline");
    expect(report.selfTest?.passed).toBe(true);
  });

  it("reports overallReady=false and a safe loadError for a missing critical file", async () => {
    const { artifactDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, omitFile: "model.json" });
    const source = new LocalFilesystemArtifactSource(artifactDir);
    const report = await runArtifactAudit(source, loadModelInferenceConfig());
    expect(report.overallReady).toBe(false);
    expect(report.criticalFilesPresent).toBe(false);
    expect(report.loadError?.code).toBe("artifact_missing");
  });

  it("never throws for a nonexistent artifact directory — reports it in the audit result instead", async () => {
    const source = new LocalFilesystemArtifactSource("/nonexistent/path/" + Date.now());
    const report = await runArtifactAudit(source, loadModelInferenceConfig());
    expect(report.criticalFilesPresent).toBe(false);
    expect(report.overallReady).toBe(false);
  });
});
