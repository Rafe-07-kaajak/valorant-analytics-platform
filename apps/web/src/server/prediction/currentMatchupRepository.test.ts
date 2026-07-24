import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCurrentMatchupDataset, resetCurrentMatchupRepositoryCacheForTesting } from "./currentMatchupRepository";

function buildFixtureEvent(overrides: Record<string, unknown> = {}) {
  return {
    internalId: "vlr:event:100",
    name: "Fixture Event",
    status: "completed",
    startDate: { iso: "2025-01-01T00:00:00.000Z", raw: "r", confidence: "high" },
    endDate: { iso: "2025-03-01T00:00:00.000Z", raw: "r", confidence: "high" },
    tournamentLevel: "league",
    region: "americas",
    eventFamily: "vct-americas",
    classification: { classification: "vct-americas", confidence: "high", reason: "r", evidence: [] },
    metadata: { provider: "vlr", providerExternalId: "100", sourceUrl: "https://www.vlr.gg/event/100", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h" },
    ...overrides,
  };
}

function buildFixtureMatch(overrides: Record<string, unknown> = {}) {
  return {
    internalId: "vlr:match:1",
    teamAId: "team-a",
    teamBId: "team-b",
    teamADisplayName: "Team A",
    teamBDisplayName: "Team B",
    matchStageDisplay: "Group Stage",
    winnerId: "team-a",
    scheduledAt: { iso: "2025-06-01T00:00:00.000Z", raw: "r", confidence: "high" },
    status: "completed",
    seriesFormat: "bo3",
    eventId: "vlr:event:100",
    maps: [],
    rosterSnapshots: [],
    sourceReference: { provider: "vlr", externalId: "1", sourceUrl: "https://www.vlr.gg/1" },
    trainingEligibility: { eligible: true, reasons: [] },
    qualityFlags: [],
    metadata: { provider: "vlr", providerExternalId: "1", sourceUrl: "https://www.vlr.gg/1", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h1" },
    ...overrides,
  };
}

async function writeFixtureCuratedDataset(rootDir: string, matches: unknown[], events: unknown[]): Promise<void> {
  const curatedDir = join(rootDir, "curated");
  await mkdir(curatedDir, { recursive: true });
  await writeFile(join(curatedDir, "matches.json"), JSON.stringify(matches), "utf-8");
  await writeFile(join(curatedDir, "events.json"), JSON.stringify(events), "utf-8");
  await writeFile(join(curatedDir, "dataset-manifest.json"), JSON.stringify({ curatedDatasetVersion: "fixture-curated-v1" }), "utf-8");
}

describe("currentMatchupRepository", () => {
  let rootDir: string | undefined;

  beforeEach(() => {
    resetCurrentMatchupRepositoryCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
  });

  afterEach(async () => {
    resetCurrentMatchupRepositoryCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
    if (rootDir) {
      await rm(rootDir, { recursive: true, force: true });
      rootDir = undefined;
    }
  });

  it("returns null (never throws) when the curated dataset directory is missing", async () => {
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = "/nonexistent-directory-for-tests";
    const result = await getCurrentMatchupDataset();
    expect(result).toBeNull();
  });

  it("loads matches/events and computes the cutoff as the maximum scheduledAt across all matches", async () => {
    rootDir = await mkdtemp(join(tmpdir(), "current-matchup-repo-test-"));
    const early = buildFixtureMatch({ internalId: "vlr:match:1", scheduledAt: { iso: "2025-06-01T00:00:00.000Z", raw: "r", confidence: "high" } });
    const late = buildFixtureMatch({ internalId: "vlr:match:2", scheduledAt: { iso: "2026-07-18T04:00:00.000Z", raw: "r", confidence: "high" } });
    await writeFixtureCuratedDataset(rootDir, [early, late], [buildFixtureEvent()]);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = rootDir;

    const dataset = await getCurrentMatchupDataset();
    expect(dataset).not.toBeNull();
    expect(dataset!.cutoffIso).toBe("2026-07-18T04:00:00.000Z");
    expect(dataset!.matches).toHaveLength(2);
    expect(dataset!.eventsById.get("vlr:event:100")).toBeDefined();
    expect(dataset!.sourceDatasetVersion).toBe("fixture-curated-v1");
  });

  it("memoizes the successful result across calls", async () => {
    rootDir = await mkdtemp(join(tmpdir(), "current-matchup-repo-test-"));
    await writeFixtureCuratedDataset(rootDir, [buildFixtureMatch()], [buildFixtureEvent()]);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = rootDir;

    const first = await getCurrentMatchupDataset();
    const second = await getCurrentMatchupDataset();
    expect(second).toBe(first);
  });

  it("returns null when no match has a resolvable scheduled timestamp", async () => {
    rootDir = await mkdtemp(join(tmpdir(), "current-matchup-repo-test-"));
    await writeFixtureCuratedDataset(rootDir, [buildFixtureMatch({ scheduledAt: { iso: null, raw: "ambiguous", confidence: "none" } })], [buildFixtureEvent()]);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = rootDir;

    const dataset = await getCurrentMatchupDataset();
    expect(dataset).toBeNull();
  });
});
