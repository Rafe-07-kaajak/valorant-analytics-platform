import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFixtureRuntimePackage } from "@repo/model-inference/testFixtures/runtimePackage";
import type { ReleasePipelineConfig } from "../releaseConfig";

/**
 * Test-only fixture composer. Builds a fixture "repo root" (lockfile +
 * root package.json), a fixture "apps/web"-like source tree, and a fixture
 * runtime package (via `@repo/model-inference`'s own real
 * `buildFixtureRuntimePackage`, which itself runs the real
 * `buildRuntimePackage` — never a parallel implementation), then returns a
 * `ReleasePipelineConfig` pointed at all three. Every "fixture release
 * bundle" test exercises the exact same `buildReleaseBundle` code path a
 * real `pnpm release:bundle:build` run would use.
 */

export interface FixtureReleaseSetup {
  readonly repoRootDir: string;
  readonly appSourceDir: string;
  readonly runtimePackageDir: string;
  readonly bundleOutputDir: string;
  readonly releaseStateDir: string;
  readonly config: ReleasePipelineConfig;
}

export interface FixtureReleaseOptions {
  /** Perturbs the fixture app source content, for change-sensitivity tests. */
  readonly appSourceVariant?: string;
  /** Perturbs the fixture lockfile content, for change-sensitivity tests. */
  readonly lockfileVariant?: string;
}

async function writeFixtureAppSource(appSourceDir: string, variant: string): Promise<void> {
  await mkdir(join(appSourceDir, "src", "app"), { recursive: true });
  await mkdir(join(appSourceDir, "public"), { recursive: true });
  await writeFile(join(appSourceDir, "package.json"), JSON.stringify({ name: "web", version: "0.1.0" }, null, 2), "utf-8");
  await writeFile(join(appSourceDir, "next.config.ts"), `export default { fixtureVariant: "${variant}" };\n`, "utf-8");
  await writeFile(join(appSourceDir, "src", "app", "page.tsx"), `export default function Page() { return null; } // ${variant}\n`, "utf-8");
  await writeFile(join(appSourceDir, "public", "favicon.ico"), `fixture-${variant}`, "utf-8");
}

export async function buildFixtureReleaseInputs(options: FixtureReleaseOptions = {}): Promise<FixtureReleaseSetup> {
  const repoRootDir = await mkdtemp(join(tmpdir(), "release-pipeline-fixture-repo-"));
  await writeFile(join(repoRootDir, "package.json"), JSON.stringify({ name: "valorant-analytics-platform", engines: { node: ">=20.0.0" }, packageManager: "pnpm@11.10.0" }, null, 2), "utf-8");
  await writeFile(join(repoRootDir, "pnpm-lock.yaml"), `lockfileVersion: fixture\nvariant: ${options.lockfileVariant ?? "base"}\n`, "utf-8");

  const appSourceDir = join(repoRootDir, "apps", "web");
  await writeFixtureAppSource(appSourceDir, options.appSourceVariant ?? "base");

  const runtimePackageFixture = await buildFixtureRuntimePackage();

  const bundleOutputDir = await mkdtemp(join(tmpdir(), "release-pipeline-fixture-bundle-"));
  const releaseStateDir = await mkdtemp(join(tmpdir(), "release-pipeline-fixture-state-"));

  const config: ReleasePipelineConfig = {
    repoRootDir,
    bundleOutputDir: join(bundleOutputDir, "release-bundle"),
    appSourceDir,
    runtimePackageDir: runtimePackageFixture.outputDir,
    releaseStateDir,
    expectedRuntimePackageVersion: undefined,
    requireCleanTree: false,
    maxFileBytes: 50_000_000,
  };

  return { repoRootDir, appSourceDir, runtimePackageDir: runtimePackageFixture.outputDir, bundleOutputDir: config.bundleOutputDir, releaseStateDir, config };
}
