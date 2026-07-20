import { rm } from "node:fs/promises";
import { describe, expect, it, afterEach } from "vitest";
import { buildFixtureReleaseInputs, type FixtureReleaseSetup } from "./testFixtures/buildFixtureReleaseInputs";
import { buildReleaseBundle } from "./bundleBuilder";
import { promoteRelease, getPromotionRecord } from "./promotion";
import { ReleaseError, isReleaseError } from "./releaseErrors";

const cleanupDirs: string[] = [];
afterEach(async () => {
  while (cleanupDirs.length > 0) await rm(cleanupDirs.pop()!, { recursive: true, force: true });
});

async function setupBuiltBundle(): Promise<FixtureReleaseSetup> {
  const fixture = await buildFixtureReleaseInputs();
  cleanupDirs.push(fixture.repoRootDir, fixture.runtimePackageDir, fixture.bundleOutputDir, fixture.releaseStateDir);
  await buildReleaseBundle({ config: fixture.config });
  return fixture;
}

describe("promoteRelease", () => {
  it("promotes candidate -> validated when the bundle validates", async () => {
    const fixture = await setupBuiltBundle();
    const record = await promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "validated" });
    expect(record.state).toBe("validated");
    expect(record.history.map((entry) => entry.state)).toEqual(["candidate", "validated"]);
  });

  it("promotes validated -> approved with a dry-run (no operator required)", async () => {
    const fixture = await setupBuiltBundle();
    await promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "validated" });
    const record = await promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "approved", dryRun: true });
    expect(record.state).toBe("approved");
    expect(record.history.at(-1)).toMatchObject({ state: "approved", dryRun: true });
  });

  it("promotes validated -> approved with sanitized operator metadata", async () => {
    const fixture = await setupBuiltBundle();
    await promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "validated" });
    const record = await promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "approved", operator: "  Jordan Ops  " });
    expect(record.history.at(-1)).toMatchObject({ state: "approved", operator: "Jordan Ops" });
  });

  it("rejects approving without an operator or --dry-run", async () => {
    const fixture = await setupBuiltBundle();
    await promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "validated" });
    await expect(promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "approved" })).rejects.toSatisfy((error: unknown) => isReleaseError(error) && (error as ReleaseError).code === "release_invalid_transition");
  });

  it("rejects an operator that looks like an email address", async () => {
    const fixture = await setupBuiltBundle();
    await promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "validated" });
    await expect(promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "approved", operator: "jordan@example.com" })).rejects.toSatisfy((error: unknown) => isReleaseError(error) && (error as ReleaseError).code === "release_config_invalid");
  });

  it("rejects skipping candidate straight to approved", async () => {
    const fixture = await setupBuiltBundle();
    await expect(promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "approved", dryRun: true })).rejects.toSatisfy((error: unknown) => isReleaseError(error) && (error as ReleaseError).code === "release_invalid_transition");
  });

  it("rejects promoting to 'deployed' or 'rolled-back'", async () => {
    const fixture = await setupBuiltBundle();
    await expect(promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "deployed" })).rejects.toSatisfy((error: unknown) => isReleaseError(error) && (error as ReleaseError).code === "release_invalid_transition");
    await expect(promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "rolled-back" })).rejects.toSatisfy((error: unknown) => isReleaseError(error) && (error as ReleaseError).code === "release_invalid_transition");
  });

  it("rejects an unknown target state", async () => {
    const fixture = await setupBuiltBundle();
    await expect(promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "garbage" })).rejects.toSatisfy((error: unknown) => isReleaseError(error) && (error as ReleaseError).code === "release_invalid_transition");
  });

  it("throws release_bundle_missing when no bundle exists at bundleDir", async () => {
    const fixture = await buildFixtureReleaseInputs();
    cleanupDirs.push(fixture.repoRootDir, fixture.runtimePackageDir, fixture.bundleOutputDir, fixture.releaseStateDir);
    await expect(promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "validated" })).rejects.toSatisfy((error: unknown) => isReleaseError(error) && (error as ReleaseError).code === "release_bundle_missing");
  });

  it("never mutates the bundle's own content-hashed files when promoting to approved", async () => {
    const fixture = await setupBuiltBundle();
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const before = await readFile(join(fixture.config.bundleOutputDir, "release-manifest.json"), "utf-8");

    await promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "validated" });
    await promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "approved", dryRun: true });

    const after = await readFile(join(fixture.config.bundleOutputDir, "release-manifest.json"), "utf-8");
    expect(after).toBe(before);
  });

  it("appends to history rather than overwriting it across repeated calls", async () => {
    const fixture = await setupBuiltBundle();
    await promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "validated" });
    await promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "validated" });
    const third = await promoteRelease({ releaseStateDir: fixture.config.releaseStateDir, bundleDir: fixture.config.bundleOutputDir, to: "validated" });
    const record = await getPromotionRecord(fixture.config.releaseStateDir, third.releaseVersion);
    expect(record!.history.length).toBeGreaterThanOrEqual(4);
  });
});
