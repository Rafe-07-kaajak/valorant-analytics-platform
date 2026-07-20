import { rm } from "node:fs/promises";
import { describe, expect, it, afterEach } from "vitest";
import { buildFixtureReleaseInputs } from "./testFixtures/buildFixtureReleaseInputs";
import { runPreflight, type CommandRunner } from "./preflight";

const cleanupDirs: string[] = [];
afterEach(async () => {
  while (cleanupDirs.length > 0) await rm(cleanupDirs.pop()!, { recursive: true, force: true });
});

async function setup() {
  const fixture = await buildFixtureReleaseInputs();
  cleanupDirs.push(fixture.repoRootDir, fixture.runtimePackageDir, fixture.bundleOutputDir, fixture.releaseStateDir);
  return fixture;
}

const alwaysPassRunner: CommandRunner = async () => ({ exitCode: 0 });
const alwaysFailRunner: CommandRunner = async () => ({ exitCode: 1 });

describe("runPreflight", () => {
  it("passes overall when every section passes (fixture runtime package, stubbed application checks passing, valid config)", async () => {
    const fixture = await setup();
    const report = await runPreflight({ config: fixture.config, commandRunner: alwaysPassRunner, env: {} });
    expect(report.passed).toBe(true);
    expect(report.lintPassed).toBe(true);
    expect(report.buildPassed).toBe(true);
  });

  it("fails overall when the application command runner reports a failure", async () => {
    const fixture = await setup();
    const report = await runPreflight({ config: fixture.config, commandRunner: alwaysFailRunner, env: {} });
    expect(report.passed).toBe(false);
    const applicationSection = report.sections.find((section) => section.name === "application");
    expect(applicationSection?.passed).toBe(false);
  });

  it("skipApplicationChecks bypasses the spawn-based checks entirely", async () => {
    const fixture = await setup();
    let called = false;
    const trackingRunner: CommandRunner = async () => {
      called = true;
      return { exitCode: 0 };
    };
    const report = await runPreflight({ config: fixture.config, skipApplicationChecks: true, commandRunner: trackingRunner, env: {} });
    expect(called).toBe(false);
    expect(report.sections.find((section) => section.name === "application")?.passed).toBe(true);
  });

  it("fails the runtimePackage section when the runtime package directory is missing", async () => {
    const fixture = await setup();
    const brokenConfig = { ...fixture.config, runtimePackageDir: `${fixture.runtimePackageDir}-missing` };
    const report = await runPreflight({ config: brokenConfig, skipApplicationChecks: true, env: {} });
    expect(report.sections.find((section) => section.name === "runtimePackage")?.passed).toBe(false);
    expect(report.passed).toBe(false);
  });

  it("fails the configuration section under strict production rules with an invalid environment", async () => {
    const fixture = await setup();
    const report = await runPreflight({ config: fixture.config, skipApplicationChecks: true, env: { REAL_PREDICTION_SOURCE_MODE: "local-generated" }, strictProductionConfig: true });
    expect(report.sections.find((section) => section.name === "configuration")?.passed).toBe(false);
  });

  it("reports clean_tree as informational (passing) by default even with a dirty tree simulated via requireCleanTree:false", async () => {
    const fixture = await setup();
    const report = await runPreflight({ config: { ...fixture.config, requireCleanTree: false }, skipApplicationChecks: true, env: {} });
    const sourceSection = report.sections.find((section) => section.name === "source");
    expect(sourceSection?.checks.find((check) => check.id === "clean_tree")?.passed).toBe(true);
  });
});
