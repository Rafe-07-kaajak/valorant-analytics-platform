import { mkdtemp, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRuntimePackage } from "./build";
import { buildFixtureRuntimePackage } from "../testFixtures/buildFixtureRuntimePackage";
import { RuntimePackageError } from "./runtimePackageErrors";

describe("buildRuntimePackage", () => {
  it("writes manifest.json, model/*, and historical/* under the output directory only", async () => {
    const fixture = await buildFixtureRuntimePackage();
    const rootEntries = await readdir(fixture.outputDir);
    expect(rootEntries.sort()).toEqual(["historical", "manifest.json", "model"]);
    const modelEntries = await readdir(join(fixture.outputDir, "model"));
    expect(modelEntries.sort()).toEqual(["calibration.json", "feature-contract.json", "model-manifest.json", "model.json", "preprocessing.json"]);
    const historicalEntries = await readdir(join(fixture.outputDir, "historical"));
    expect(historicalEntries.sort()).toEqual(["historical-index.json", "historical-manifest.json", "historical-rows.json"]);
  });

  it("never modifies any file under the source model or source feature directories", async () => {
    const fixture = await buildFixtureRuntimePackage();
    const sourceModelStatsBefore = await stat(join(fixture.sourceModelDir, "model.json"));
    const sourceFeatureStatsBefore = await stat(join(fixture.sourceFeatureDataDir, "features", "feature-rows.json"));

    // Rebuild into the same output directory.
    await buildRuntimePackage({ outputDir: fixture.outputDir, sourceModelDir: fixture.sourceModelDir, sourceFeatureDataDir: fixture.sourceFeatureDataDir, maxFileBytes: 50_000_000 });

    const sourceModelStatsAfter = await stat(join(fixture.sourceModelDir, "model.json"));
    const sourceFeatureStatsAfter = await stat(join(fixture.sourceFeatureDataDir, "features", "feature-rows.json"));
    expect(sourceModelStatsAfter.mtimeMs).toBe(sourceModelStatsBefore.mtimeMs);
    expect(sourceFeatureStatsAfter.mtimeMs).toBe(sourceFeatureStatsBefore.mtimeMs);
  });

  it("is idempotent: rebuilding from unchanged source data reproduces the same runtimePackageVersion and file hashes, only generatedAt differs", async () => {
    const fixture = await buildFixtureRuntimePackage();
    const first = fixture.buildResult.manifest;

    // Small delay isn't needed for generatedAt to differ in practice, but be defensive.
    await new Promise((resolve) => setTimeout(resolve, 5));

    const secondOutputDir = await mkdtemp(join(tmpdir(), "runtime-package-rebuild-"));
    const second = (await buildRuntimePackage({ outputDir: secondOutputDir, sourceModelDir: fixture.sourceModelDir, sourceFeatureDataDir: fixture.sourceFeatureDataDir, maxFileBytes: 50_000_000 })).manifest;

    expect(second.runtimePackageVersion).toBe(first.runtimePackageVersion);
    expect(second.model.files).toEqual(first.model.files);
    expect(second.historical.files).toEqual(first.historical.files);
    expect(second.generatedAt).not.toBe(first.generatedAt);
  });

  it("fails the build when the model's declared sourceFeatureDatasetVersion disagrees with the source feature dataset's own version", async () => {
    const fixture = await buildFixtureRuntimePackage();
    // Corrupt the source feature dataset's declared version after the fixture was built.
    const manifestPath = join(fixture.sourceFeatureDataDir, "features", "feature-manifest.json");
    const raw = JSON.parse(await (await import("node:fs/promises")).readFile(manifestPath, "utf-8"));
    raw.featureDatasetVersion = "a-different-version";
    await writeFile(manifestPath, JSON.stringify(raw), "utf-8");

    const outputDir = await mkdtemp(join(tmpdir(), "runtime-package-mismatch-"));
    await expect(buildRuntimePackage({ outputDir, sourceModelDir: fixture.sourceModelDir, sourceFeatureDataDir: fixture.sourceFeatureDataDir, maxFileBytes: 50_000_000 })).rejects.toBeInstanceOf(RuntimePackageError);
  });
});
