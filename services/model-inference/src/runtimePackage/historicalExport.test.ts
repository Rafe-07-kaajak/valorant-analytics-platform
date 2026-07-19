import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stableStringify } from "@repo/vlr-ingestion";
import { buildHistoricalExport, type HistoricalExportContract } from "./historicalExport";
import { RuntimePackageError } from "./runtimePackageErrors";

const CONTRACT: HistoricalExportContract = {
  requiredInputFields: ["teamAEloRating", "teamBEloRating", "teamADaysSinceLastMatch"],
  nullableNumericFields: ["teamADaysSinceLastMatch"],
};

function baseRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    matchInternalId: "vlr:match:1",
    scheduledAt: "2026-01-01T00:00:00.000Z",
    eventInternalId: "vlr:event:1",
    eventFamily: "vct-americas",
    eventRegion: "americas",
    eventStage: "group-stage",
    tournamentLevel: "tier-1",
    seriesFormat: "BO3",
    teamAProviderId: "vlr:team:1",
    teamBProviderId: "vlr:team:2",
    sourceDatasetVersion: "curated-v1",
    featureSchemaVersion: "schema-v1",
    featureRulesVersion: "rules-v1",
    labelTeamAWin: 1,
    labelWinnerProviderId: "vlr:team:1",
    labelSeriesScore: "2-1",
    labelMapCountPlayed: 3,
    foldAssignment: 2,
    splitAssignment: "train",
    teamAEloRating: 1500,
    teamBEloRating: 1400,
    teamADaysSinceLastMatch: 5,
    ...overrides,
  };
}

async function writeSourceDataset(rows: readonly Record<string, unknown>[]): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), "historical-export-test-"));
  const featuresDir = join(rootDir, "features");
  await mkdir(featuresDir, { recursive: true });
  await writeFile(join(featuresDir, "feature-manifest.json"), JSON.stringify({ featureDatasetVersion: "dataset-v1", featureSchemaVersion: "schema-v1", featureRulesVersion: "rules-v1", rowCount: rows.length }), "utf-8");
  await writeFile(join(featuresDir, "feature-rows.json"), JSON.stringify(rows), "utf-8");
  return rootDir;
}

describe("buildHistoricalExport", () => {
  it("strips label and split/fold fields, keeping only safe metadata + required input fields", async () => {
    const dir = await writeSourceDataset([baseRow()]);
    const result = await buildHistoricalExport(dir, CONTRACT);
    const row = result.rows[0];
    expect(row).not.toHaveProperty("labelTeamAWin");
    expect(row).not.toHaveProperty("labelWinnerProviderId");
    expect(row).not.toHaveProperty("labelSeriesScore");
    expect(row).not.toHaveProperty("labelMapCountPlayed");
    expect(row).not.toHaveProperty("foldAssignment");
    expect(row).not.toHaveProperty("splitAssignment");
    expect(row.teamAEloRating).toBe(1500);
    expect(row.matchInternalId).toBe("vlr:match:1");
  });

  it("produces a matching safe catalog index with no label fields", async () => {
    const dir = await writeSourceDataset([baseRow()]);
    const result = await buildHistoricalExport(dir, CONTRACT);
    expect(result.index).toHaveLength(1);
    expect(result.index[0]).not.toHaveProperty("labelTeamAWin");
    expect(result.index[0].modelEligible).toBe(true);
  });

  it("rejects a row missing a required model input field", async () => {
    const row = baseRow();
    delete row.teamBEloRating;
    const dir = await writeSourceDataset([row]);
    await expect(buildHistoricalExport(dir, CONTRACT)).rejects.toBeInstanceOf(RuntimePackageError);
  });

  it("rejects a non-finite value for a required field", async () => {
    const dir = await writeSourceDataset([baseRow({ teamAEloRating: Number.NaN })]);
    await expect(buildHistoricalExport(dir, CONTRACT)).rejects.toBeInstanceOf(RuntimePackageError);
  });

  it("allows null for a nullable numeric field", async () => {
    const dir = await writeSourceDataset([baseRow({ teamADaysSinceLastMatch: null })]);
    const result = await buildHistoricalExport(dir, CONTRACT);
    expect(result.rows[0].teamADaysSinceLastMatch).toBeNull();
  });

  it("rejects null for a non-nullable required field", async () => {
    const dir = await writeSourceDataset([baseRow({ teamAEloRating: null })]);
    await expect(buildHistoricalExport(dir, CONTRACT)).rejects.toBeInstanceOf(RuntimePackageError);
  });

  it("rejects a duplicate matchInternalId", async () => {
    const dir = await writeSourceDataset([baseRow(), baseRow()]);
    await expect(buildHistoricalExport(dir, CONTRACT)).rejects.toBeInstanceOf(RuntimePackageError);
  });

  it("orders rows chronologically, tie-broken by matchInternalId", async () => {
    const rows = [baseRow({ matchInternalId: "vlr:match:b", scheduledAt: "2026-01-01T00:00:00.000Z" }), baseRow({ matchInternalId: "vlr:match:a", scheduledAt: "2026-01-01T00:00:00.000Z" }), baseRow({ matchInternalId: "vlr:match:z", scheduledAt: "2025-01-01T00:00:00.000Z" })];
    const dir = await writeSourceDataset(rows);
    const result = await buildHistoricalExport(dir, CONTRACT);
    expect(result.rows.map((r) => r.matchInternalId)).toEqual(["vlr:match:z", "vlr:match:a", "vlr:match:b"]);
  });

  it("produces byte-identical stable serialization across two runs", async () => {
    const dir = await writeSourceDataset([baseRow(), baseRow({ matchInternalId: "vlr:match:2", scheduledAt: "2026-02-01T00:00:00.000Z" })]);
    const first = await buildHistoricalExport(dir, CONTRACT);
    const second = await buildHistoricalExport(dir, CONTRACT);
    expect(stableStringify(first.rows)).toBe(stableStringify(second.rows));
    expect(stableStringify(first.index)).toBe(stableStringify(second.index));
  });
});
