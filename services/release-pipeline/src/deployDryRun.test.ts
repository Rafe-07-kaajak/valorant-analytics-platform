import { rm } from "node:fs/promises";
import { describe, expect, it, afterEach } from "vitest";
import { buildFixtureReleaseInputs } from "./testFixtures/buildFixtureReleaseInputs";
import { buildReleaseBundle } from "./bundleBuilder";
import { buildDeploymentPlan } from "./deployDryRun";
import { ReleaseError, isReleaseError } from "./releaseErrors";

const cleanupDirs: string[] = [];
afterEach(async () => {
  while (cleanupDirs.length > 0) await rm(cleanupDirs.pop()!, { recursive: true, force: true });
});

describe("buildDeploymentPlan", () => {
  it("produces a plan with explicit no-op disclaimers and matches the built release version", async () => {
    const fixture = await buildFixtureReleaseInputs();
    cleanupDirs.push(fixture.repoRootDir, fixture.runtimePackageDir, fixture.bundleOutputDir, fixture.releaseStateDir);
    const built = await buildReleaseBundle({ config: fixture.config });

    const plan = await buildDeploymentPlan(fixture.config.bundleOutputDir, "local-node-server");
    expect(plan.releaseVersion).toBe(built.manifest.releaseVersion);
    expect(plan.targetSupportLevel).toBe("supported");
    expect(plan.disclaimers).toEqual(["No deployment occurred.", "No network request occurred.", "No credential was used.", "No external system was changed."]);
    expect(plan.startupSteps.length).toBeGreaterThan(0);
    expect(plan.rollbackSteps.length).toBeGreaterThan(0);
  });

  it("throws release_bundle_missing when no bundle has been built", async () => {
    await expect(buildDeploymentPlan("/definitely/does/not/exist")).rejects.toSatisfy((error: unknown) => isReleaseError(error) && (error as ReleaseError).code === "release_bundle_missing");
  });

  it("reports the correct support level for each declared release target", async () => {
    const fixture = await buildFixtureReleaseInputs();
    cleanupDirs.push(fixture.repoRootDir, fixture.runtimePackageDir, fixture.bundleOutputDir, fixture.releaseStateDir);
    await buildReleaseBundle({ config: fixture.config });

    expect((await buildDeploymentPlan(fixture.config.bundleOutputDir, "manual-operator-deployment")).targetSupportLevel).toBe("supported");
    expect((await buildDeploymentPlan(fixture.config.bundleOutputDir, "nextjs-standalone" as never)).targetSupportLevel).toBe("conditional");
  });

  it("reports environment incompatibility when sourceCommitSha is unavailable (fixture repo is not a Git checkout)", async () => {
    const fixture = await buildFixtureReleaseInputs();
    cleanupDirs.push(fixture.repoRootDir, fixture.runtimePackageDir, fixture.bundleOutputDir, fixture.releaseStateDir);
    const built = await buildReleaseBundle({ config: fixture.config });

    const plan = await buildDeploymentPlan(fixture.config.bundleOutputDir);
    if (!built.manifest.sourceCommitSha) {
      expect(plan.environmentCompatible).toBe(false);
      expect(plan.environmentIssues.length).toBeGreaterThan(0);
    }
  });
});
