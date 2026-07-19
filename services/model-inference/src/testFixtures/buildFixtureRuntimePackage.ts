import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFixtureArtifact, FIXTURE_FEATURE_CONTRACT, ELO_FIXTURE_MODEL, type FixtureArtifactOptions } from "./buildFixtureArtifact";
import { buildRuntimePackage } from "../runtimePackage/build";
import type { BuildRuntimePackageResult } from "../runtimePackage/build";

/**
 * Test-only fixture builder for TASK-048's runtime packaging feature.
 * Composes the existing `buildFixtureArtifact` (model side) with a small
 * hand-built fixture feature-dataset export, then builds the package
 * through the *real* production `buildRuntimePackage` function — so every
 * test exercising a "fixture runtime package" is exercising the exact same
 * code path a real `pnpm runtime:package:build` run would use, not a
 * parallel/duplicated implementation.
 */

export const FIXTURE_RUNTIME_PACKAGE_FEATURE_DATASET_VERSION = "fixture-source-v1";

export interface FixtureHistoricalRowInput {
  readonly matchInternalId: string;
  readonly scheduledAt: string;
  readonly eventFamily?: string;
  readonly teamAProviderId?: string;
  readonly teamBProviderId?: string;
}

function buildFixtureRow(input: FixtureHistoricalRowInput): Record<string, unknown> {
  return {
    matchInternalId: input.matchInternalId,
    scheduledAt: input.scheduledAt,
    eventInternalId: "vlr:event:fixture-1",
    eventFamily: input.eventFamily ?? "vct-americas",
    eventRegion: "americas",
    eventStage: "group-stage",
    tournamentLevel: "tier-1",
    seriesFormat: "BO3",
    teamAProviderId: input.teamAProviderId ?? "vlr:team:fixture-a",
    teamBProviderId: input.teamBProviderId ?? "vlr:team:fixture-b",
    sourceDatasetVersion: "fixture-curated-v1",
    featureSchemaVersion: FIXTURE_FEATURE_CONTRACT.featureSchemaVersion,
    featureRulesVersion: FIXTURE_FEATURE_CONTRACT.featureRulesVersion,
    labelTeamAWin: 1,
    labelWinnerProviderId: input.teamAProviderId ?? "vlr:team:fixture-a",
    labelSeriesScore: "2-1",
    labelMapCountPlayed: 3,
    teamAEloWinProbability: 0.62,
    teamAEloRating: 1550,
    teamBEloRating: 1480,
    teamADaysSinceLastMatch: 5,
    teamAHasPriorMatch: true,
  };
}

export const FIXTURE_RUNTIME_PACKAGE_ROWS: readonly FixtureHistoricalRowInput[] = [
  { matchInternalId: "vlr:match:fixture-1001", scheduledAt: "2026-01-01T00:00:00.000Z", eventFamily: "vct-americas" },
  { matchInternalId: "vlr:match:fixture-1002", scheduledAt: "2026-02-01T00:00:00.000Z", eventFamily: "masters", teamAProviderId: "vlr:team:fixture-c", teamBProviderId: "vlr:team:fixture-d" },
];

export interface FixtureRuntimePackageOptions {
  readonly rows?: readonly FixtureHistoricalRowInput[];
  readonly modelOptions?: Partial<FixtureArtifactOptions>;
}

export interface FixtureRuntimePackage {
  readonly sourceModelDir: string;
  readonly sourceFeatureDataDir: string;
  readonly outputDir: string;
  readonly buildResult: BuildRuntimePackageResult;
}


/** Builds a fixture source model artifact + fixture source feature dataset into fresh temp directories, then packages them via the real `buildRuntimePackage` into a third fresh temp directory. Returns all three paths plus the build result. */
export async function buildFixtureRuntimePackage(options: FixtureRuntimePackageOptions = {}): Promise<FixtureRuntimePackage> {
  const rows = options.rows ?? FIXTURE_RUNTIME_PACKAGE_ROWS;

  const { artifactDir: sourceModelDir } = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, manifestOverrides: { sourceFeatureDatasetVersion: FIXTURE_RUNTIME_PACKAGE_FEATURE_DATASET_VERSION }, ...options.modelOptions });

  const featureRootDir = await mkdtemp(join(tmpdir(), "runtime-package-fixture-features-"));
  const featuresDir = join(featureRootDir, "features");
  await mkdir(featuresDir, { recursive: true });

  const manifest = {
    featureCount: FIXTURE_FEATURE_CONTRACT.requiredInputFields.length,
    featureDatasetVersion: FIXTURE_RUNTIME_PACKAGE_FEATURE_DATASET_VERSION,
    featureRulesVersion: FIXTURE_FEATURE_CONTRACT.featureRulesVersion,
    featureSchemaVersion: FIXTURE_FEATURE_CONTRACT.featureSchemaVersion,
    generatedAt: "2026-01-01T00:00:00.000Z",
    rowCount: rows.length,
    sourceDatasetVersion: "fixture-curated-v1",
  };
  await writeFile(join(featuresDir, "feature-manifest.json"), JSON.stringify(manifest), "utf-8");
  await writeFile(join(featuresDir, "feature-rows.json"), JSON.stringify(rows.map(buildFixtureRow)), "utf-8");

  const outputDir = await mkdtemp(join(tmpdir(), "runtime-package-fixture-output-"));

  const buildResult = await buildRuntimePackage({
    outputDir,
    sourceModelDir,
    sourceFeatureDataDir: featureRootDir,
    maxFileBytes: 50_000_000,
  });

  return { sourceModelDir, sourceFeatureDataDir: featureRootDir, outputDir, buildResult };
}
