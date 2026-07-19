import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIXTURE_FEATURE_CONTRACT } from "@repo/model-inference/testFixtures";
import type { RawHistoricalRow } from "../historicalFeatureRepository";

/**
 * Test-only fixture feature dataset builder for TASK-047's server-side
 * tests. Mirrors `@repo/model-inference`'s own `buildFixtureArtifact` — rows
 * are shaped to satisfy `FIXTURE_FEATURE_CONTRACT.requiredInputFields`
 * (reused, not duplicated) so a fixture artifact and a fixture feature
 * dataset can be used together in an integration test without depending on
 * the real gitignored TASK-044/045 output.
 */

export const FIXTURE_FEATURE_DATASET_VERSION = "fixture-feature-dataset-v1";

export interface FixtureRowOverrides extends Partial<RawHistoricalRow> {
  readonly matchInternalId: string;
}

function buildRow(overrides: FixtureRowOverrides): RawHistoricalRow {
  return {
    scheduledAt: "2026-01-01T00:00:00.000Z",
    eventInternalId: "vlr:event:1",
    eventFamily: "vct-americas",
    eventRegion: "americas",
    eventStage: "group-stage",
    tournamentLevel: "tier-1",
    seriesFormat: "BO3",
    teamAProviderId: "vlr:team:1",
    teamBProviderId: "vlr:team:2",
    featureSchemaVersion: FIXTURE_FEATURE_CONTRACT.featureSchemaVersion,
    featureRulesVersion: FIXTURE_FEATURE_CONTRACT.featureRulesVersion,
    sourceDatasetVersion: "fixture-curated-v1",
    labelTeamAWin: 1,
    labelWinnerProviderId: "vlr:team:1",
    labelSeriesScore: "2-1",
    labelMapCountPlayed: 3,
    teamAEloWinProbability: 0.62,
    teamAEloRating: 1550,
    teamBEloRating: 1480,
    teamADaysSinceLastMatch: 5,
    teamAHasPriorMatch: true,
    ...overrides,
  };
}

export const FIXTURE_HISTORICAL_ROWS: readonly RawHistoricalRow[] = [
  buildRow({ matchInternalId: "vlr:match:1001", scheduledAt: "2026-01-01T00:00:00.000Z", eventFamily: "vct-americas" }),
  buildRow({ matchInternalId: "vlr:match:1002", scheduledAt: "2026-02-01T00:00:00.000Z", eventFamily: "masters", teamAProviderId: "vlr:team:3", teamBProviderId: "vlr:team:4" }),
];

export interface FixtureFeatureDataset {
  readonly rootDir: string;
}

/** Writes a fixture `<rootDir>/features/{feature-manifest.json,feature-rows.json}` and returns `rootDir` — set `REAL_PREDICTION_FEATURE_DATA_DIR` to this value in a test. */
export async function buildFixtureFeatureDataset(rows: readonly RawHistoricalRow[] = FIXTURE_HISTORICAL_ROWS): Promise<FixtureFeatureDataset> {
  const rootDir = await mkdtemp(join(tmpdir(), "real-prediction-fixture-"));
  const featuresDir = join(rootDir, "features");
  await mkdir(featuresDir, { recursive: true });

  const manifest = {
    featureDatasetVersion: FIXTURE_FEATURE_DATASET_VERSION,
    featureSchemaVersion: FIXTURE_FEATURE_CONTRACT.featureSchemaVersion,
    featureRulesVersion: FIXTURE_FEATURE_CONTRACT.featureRulesVersion,
    rowCount: rows.length,
  };

  await writeFile(join(featuresDir, "feature-manifest.json"), JSON.stringify(manifest), "utf-8");
  await writeFile(join(featuresDir, "feature-rows.json"), JSON.stringify(rows), "utf-8");

  return { rootDir };
}
