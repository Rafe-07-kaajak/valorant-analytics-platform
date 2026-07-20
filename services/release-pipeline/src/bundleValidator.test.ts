import { rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { buildFixtureReleaseInputs, type FixtureReleaseSetup } from "./testFixtures/buildFixtureReleaseInputs";
import { buildReleaseBundle } from "./bundleBuilder";
import { validateReleaseBundle } from "./bundleValidator";

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

describe("validateReleaseBundle", () => {
  it("accepts a freshly built bundle with zero errors and zero security findings", async () => {
    const fixture = await setupBuiltBundle();
    const result = await validateReleaseBundle(fixture.config.bundleOutputDir);
    expect(result.errors).toEqual([]);
    expect(result.securityFindings).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("reports release_bundle_missing for a nonexistent directory", async () => {
    const result = await validateReleaseBundle("/definitely/does/not/exist/anywhere");
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe("release_bundle_missing");
  });

  it("rejects a hand-edited release-manifest.json (releaseVersion no longer reproducible)", async () => {
    const fixture = await setupBuiltBundle();
    const manifestPath = join(fixture.config.bundleOutputDir, "release-manifest.json");
    const { readFile } = await import("node:fs/promises");
    const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
    manifest.releaseVersion = "0000000000000000";
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

    const result = await validateReleaseBundle(fixture.config.bundleOutputDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("Recomputed releaseVersion"))).toBe(true);
  });

  it("rejects a missing required file", async () => {
    const fixture = await setupBuiltBundle();
    await rm(join(fixture.config.bundleOutputDir, "operations", "rollback-manifest.json"));
    const result = await validateReleaseBundle(fixture.config.bundleOutputDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("operations/rollback-manifest.json"))).toBe(true);
  });

  it("rejects a forbidden file planted inside the bundle", async () => {
    const fixture = await setupBuiltBundle();
    await writeFile(join(fixture.config.bundleOutputDir, "config", ".env"), "SECRET=1\n", "utf-8");
    const result = await validateReleaseBundle(fixture.config.bundleOutputDir);
    expect(result.valid).toBe(false);
    expect(result.securityFindings.some((finding) => finding.code === "release_forbidden_file")).toBe(true);
  });

  it("rejects a secret-shaped string planted inside an allowlisted file", async () => {
    const fixture = await setupBuiltBundle();
    await writeFile(join(fixture.config.bundleOutputDir, "config", "environment-example.txt"), "AKIAABCDEFGHIJKLMNOP\n", "utf-8");
    const result = await validateReleaseBundle(fixture.config.bundleOutputDir);
    expect(result.valid).toBe(false);
    expect(result.securityFindings.some((finding) => finding.code === "release_secret_detected")).toBe(true);
  });

  it("deep mode (--deep equivalent) catches a live source tree drift not reflected in the bundle", async () => {
    const fixture = await setupBuiltBundle();
    await mkdir(join(fixture.appSourceDir, "src"), { recursive: true });
    await writeFile(join(fixture.appSourceDir, "src", "new-file.ts"), "export const x = 1;\n", "utf-8");

    const shallow = await validateReleaseBundle(fixture.config.bundleOutputDir);
    expect(shallow.valid).toBe(true);

    const deep = await validateReleaseBundle(fixture.config.bundleOutputDir, { appSourceDir: fixture.appSourceDir });
    expect(deep.valid).toBe(false);
    expect(deep.errors.some((error) => error.includes("Live application source fingerprint"))).toBe(true);
  });
});
