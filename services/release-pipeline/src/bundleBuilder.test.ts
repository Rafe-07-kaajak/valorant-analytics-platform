import { rm } from "node:fs/promises";
import { describe, expect, it, afterEach } from "vitest";
import { buildFixtureReleaseInputs, type FixtureReleaseSetup } from "./testFixtures/buildFixtureReleaseInputs";
import { buildReleaseBundle } from "./bundleBuilder";
import { ReleaseError, isReleaseError } from "./releaseErrors";

const cleanupDirs: string[] = [];
afterEach(async () => {
  while (cleanupDirs.length > 0) await rm(cleanupDirs.pop()!, { recursive: true, force: true });
});

async function setup(options?: Parameters<typeof buildFixtureReleaseInputs>[0]): Promise<FixtureReleaseSetup> {
  const fixture = await buildFixtureReleaseInputs(options);
  cleanupDirs.push(fixture.repoRootDir, fixture.runtimePackageDir, fixture.bundleOutputDir, fixture.releaseStateDir);
  return fixture;
}

describe("buildReleaseBundle", () => {
  it("builds a bundle with all expected files against fixture inputs", async () => {
    const fixture = await setup();
    const result = await buildReleaseBundle({ config: fixture.config });

    expect(result.manifest.releaseVersion).toMatch(/^[0-9a-f]{16}$/);
    expect(result.manifest.runtimePackageVersion).toBeTruthy();
    expect(result.manifest.modelVersion).toBeTruthy();
    expect(result.manifest.securityAssertions).toEqual({ noSecretsDetected: true, noAbsolutePaths: true, noRawFeatureData: true, noRawLabels: true, allowlistEnforced: true });
    expect(result.manifest.testVerificationSummary).toEqual({ performed: false });
    expect(result.outputDir).toBe(fixture.config.bundleOutputDir);
  });

  it("is idempotent: rebuilding against unchanged fixture inputs reproduces the same releaseVersion and file hashes (generatedAt may differ)", async () => {
    const fixture = await setup();
    const first = await buildReleaseBundle({ config: fixture.config });
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
    const second = await buildReleaseBundle({ config: fixture.config });

    expect(second.manifest.releaseVersion).toBe(first.manifest.releaseVersion);
    expect(second.manifest.applicationFiles).toEqual(first.manifest.applicationFiles);
    expect(second.manifest.runtimePackageFiles).toEqual(first.manifest.runtimePackageFiles);
    expect(second.manifest.generatedAt).not.toBe(first.manifest.generatedAt);
  });

  it("changes releaseVersion when the fixture application source changes", async () => {
    const fixtureA = await setup({ appSourceVariant: "variant-a" });
    const resultA = await buildReleaseBundle({ config: fixtureA.config });

    const fixtureB = await setup({ appSourceVariant: "variant-b" });
    const resultB = await buildReleaseBundle({ config: fixtureB.config });

    expect(resultB.manifest.releaseVersion).not.toBe(resultA.manifest.releaseVersion);
    expect(resultB.manifest.applicationBuildFingerprint).not.toBe(resultA.manifest.applicationBuildFingerprint);
    // Runtime package identity is unaffected by an application-only change.
    expect(resultB.manifest.runtimePackageVersion).toBe(resultA.manifest.runtimePackageVersion);
  });

  it("changes releaseVersion when the fixture lockfile changes", async () => {
    const fixtureA = await setup({ lockfileVariant: "lockfile-a" });
    const resultA = await buildReleaseBundle({ config: fixtureA.config });

    const fixtureB = await setup({ lockfileVariant: "lockfile-b" });
    const resultB = await buildReleaseBundle({ config: fixtureB.config });

    expect(resultB.manifest.lockfileHash).not.toBe(resultA.manifest.lockfileHash);
    expect(resultB.manifest.releaseVersion).not.toBe(resultA.manifest.releaseVersion);
  });

  it("throws release_runtime_package_missing when the runtime package directory does not exist", async () => {
    const fixture = await setup();
    const brokenConfig = { ...fixture.config, runtimePackageDir: `${fixture.runtimePackageDir}-does-not-exist` };
    await expect(buildReleaseBundle({ config: brokenConfig })).rejects.toSatisfy((error: unknown) => isReleaseError(error) && (error as ReleaseError).code === "release_runtime_package_missing");
  });

  it("never mutates the source runtime package or the fixture app source tree", async () => {
    const fixture = await setup();
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const beforeNextConfig = await readFile(join(fixture.appSourceDir, "next.config.ts"), "utf-8");
    const beforeManifest = await readFile(join(fixture.runtimePackageDir, "manifest.json"), "utf-8");

    await buildReleaseBundle({ config: fixture.config });

    expect(await readFile(join(fixture.appSourceDir, "next.config.ts"), "utf-8")).toBe(beforeNextConfig);
    expect(await readFile(join(fixture.runtimePackageDir, "manifest.json"), "utf-8")).toBe(beforeManifest);
  });

  it("threads a previous release ref into a compatible rollback manifest", async () => {
    const fixture = await setup();
    const first = await buildReleaseBundle({ config: fixture.config });
    const previousRelease = { releaseVersion: first.manifest.releaseVersion, runtimePackageVersion: first.manifest.runtimePackageVersion, modelVersion: first.manifest.modelVersion, sourceFeatureDatasetVersion: first.manifest.sourceFeatureDatasetVersion, featureSchemaVersion: first.manifest.featureSchemaVersion, featureRulesVersion: first.manifest.featureRulesVersion };

    const second = await buildReleaseBundle({ config: fixture.config, previousRelease });
    expect(second.rollbackManifest.previousReleaseVersion).toBe(first.manifest.releaseVersion);
    expect(second.rollbackManifest.rollbackCompatible).toBe(true);
    expect(second.manifest.rollbackCompatibilityMetadata).toEqual({ previousReleaseVersion: first.manifest.releaseVersion, rollbackCompatible: true });
  });
});
