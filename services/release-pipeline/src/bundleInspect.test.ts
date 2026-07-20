import { rm } from "node:fs/promises";
import { describe, expect, it, afterEach } from "vitest";
import { buildFixtureReleaseInputs } from "./testFixtures/buildFixtureReleaseInputs";
import { buildReleaseBundle } from "./bundleBuilder";
import { getReleaseBundleStatus, inspectReleaseBundle, describeCleanTarget } from "./bundleInspect";

const cleanupDirs: string[] = [];
afterEach(async () => {
  while (cleanupDirs.length > 0) await rm(cleanupDirs.pop()!, { recursive: true, force: true });
});

describe("bundleInspect", () => {
  it("getReleaseBundleStatus reports exists:false for a nonexistent bundle", async () => {
    expect(await getReleaseBundleStatus("/definitely/does/not/exist")).toEqual({ exists: false });
  });

  it("getReleaseBundleStatus/inspectReleaseBundle report real fields for a built bundle", async () => {
    const fixture = await buildFixtureReleaseInputs();
    cleanupDirs.push(fixture.repoRootDir, fixture.runtimePackageDir, fixture.bundleOutputDir, fixture.releaseStateDir);
    const built = await buildReleaseBundle({ config: fixture.config });

    const status = await getReleaseBundleStatus(fixture.config.bundleOutputDir);
    expect(status.exists).toBe(true);
    expect(status.releaseVersion).toBe(built.manifest.releaseVersion);

    const inspection = await inspectReleaseBundle(fixture.config.bundleOutputDir);
    expect(inspection.applicationFileCount).toBe(built.manifest.applicationFiles.length);
    expect(inspection.runtimePackageFileCount).toBe(built.manifest.runtimePackageFiles.length);
    expect(inspection.securityAssertions).toEqual(built.manifest.securityAssertions);
  });

  it("never includes an absolute path in a status/inspection result", async () => {
    const fixture = await buildFixtureReleaseInputs();
    cleanupDirs.push(fixture.repoRootDir, fixture.runtimePackageDir, fixture.bundleOutputDir, fixture.releaseStateDir);
    await buildReleaseBundle({ config: fixture.config });

    const inspection = await inspectReleaseBundle(fixture.config.bundleOutputDir);
    const serialized = JSON.stringify(inspection);
    expect(serialized).not.toContain(fixture.config.bundleOutputDir);
  });

  it("describeCleanTarget lists top-level entries without deleting anything", async () => {
    const fixture = await buildFixtureReleaseInputs();
    cleanupDirs.push(fixture.repoRootDir, fixture.runtimePackageDir, fixture.bundleOutputDir, fixture.releaseStateDir);
    await buildReleaseBundle({ config: fixture.config });

    const target = await describeCleanTarget(fixture.config.bundleOutputDir);
    expect(target.exists).toBe(true);
    expect(target.entries).toContain("release-manifest.json");

    const stillThere = await getReleaseBundleStatus(fixture.config.bundleOutputDir);
    expect(stillThere.exists).toBe(true);
  });
});
