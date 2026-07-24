import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPowerRankingsRealData, resetPowerRankingsRepositoryCacheForTesting } from "./powerRankingsRepository";

/**
 * Minimal fixture rows only carry the fields `buildTeamRealDataStates`
 * actually reads (see `services/vlr-ingestion/src/feature/teamRealDataState.ts`)
 * — this repository reads the JSON files as loosely-typed data (mirrors
 * `historicalFeatureRepository.ts`'s own convention), so a full 166-column
 * FeatureRow fixture is unnecessary here.
 */
function buildFixtureRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    matchInternalId: "vlr:match:1",
    scheduledAt: "2025-07-01T00:00:00.000Z",
    teamAProviderId: "team-a",
    teamBProviderId: "team-b",
    teamAEloRating: 1600,
    teamBEloRating: 1400,
    teamALast10WinRate: 0.7,
    teamALast10MatchCount: 8,
    teamBLast10WinRate: 0.3,
    teamBLast10MatchCount: 8,
    teamACumulativeWinRate: 0.6,
    teamBCumulativeWinRate: 0.4,
    teamAMapPoolBreadth: 5,
    teamBMapPoolBreadth: 4,
    teamARecentMapWinRateLast10: 0.6,
    teamBRecentMapWinRateLast10: 0.4,
    teamAAvgRoundsWonPerMap: 8,
    teamBAvgRoundsWonPerMap: 6,
    teamAAvgOpponentEloLast10: 1500,
    teamBAvgOpponentEloLast10: 1500,
    isMastersOrChampions: false,
    isInternationalEvent: false,
    isRegionalLeague: true,
    ...overrides,
  };
}

async function writeFixtureDataset(rootDir: string): Promise<void> {
  const featuresDir = join(rootDir, "features");
  const curatedDir = join(rootDir, "curated");
  await mkdir(featuresDir, { recursive: true });
  await mkdir(curatedDir, { recursive: true });

  await writeFile(join(featuresDir, "feature-manifest.json"), JSON.stringify({ featureDatasetVersion: "fixture-v1" }), "utf-8");
  await writeFile(join(featuresDir, "feature-rows.json"), JSON.stringify([buildFixtureRow()]), "utf-8");
  await writeFile(
    join(featuresDir, "canonical-window.json"),
    JSON.stringify({ windowStartIso: "2025-06-07T12:00:00.000Z", sourceEventInternalId: "vlr:event:2282", sourceEventName: "Valorant Masters Toronto 2025" }),
    "utf-8",
  );
  await writeFile(
    join(curatedDir, "identity-mappings.json"),
    JSON.stringify({ teamMapping: [{ internalTeamId: "team-a", status: "verified" }, { internalTeamId: "team-b", status: "provisional" }] }),
    "utf-8",
  );
}

describe("powerRankingsRepository", () => {
  let rootDir: string | undefined;

  beforeEach(() => {
    resetPowerRankingsRepositoryCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
  });

  afterEach(async () => {
    resetPowerRankingsRepositoryCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
    if (rootDir) {
      await rm(rootDir, { recursive: true, force: true });
      rootDir = undefined;
    }
  });

  it("returns null (never throws) when the dataset directory is missing", async () => {
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = "/nonexistent-directory-for-tests";
    const result = await getPowerRankingsRealData();
    expect(result).toBeNull();
  });

  it("loads real per-team states, the canonical window, and the verified-team-id set from a fixture dataset", async () => {
    rootDir = await mkdtemp(join(tmpdir(), "power-rankings-repo-test-"));
    await writeFixtureDataset(rootDir);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = rootDir;

    const result = await getPowerRankingsRealData();
    expect(result).not.toBeNull();
    expect(result!.featureDatasetVersion).toBe("fixture-v1");
    expect(result!.canonicalWindow.sourceEventName).toBe("Valorant Masters Toronto 2025");
    expect(result!.states.get("team-a")?.eloRating).toBe(1600);
    expect(result!.states.get("team-b")?.eloRating).toBe(1400);
    expect(result!.verifiedTeamIds.has("team-a")).toBe(true);
    expect(result!.verifiedTeamIds.has("team-b")).toBe(false);
  });

  it("memoizes the successful result across calls", async () => {
    rootDir = await mkdtemp(join(tmpdir(), "power-rankings-repo-test-"));
    await writeFixtureDataset(rootDir);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = rootDir;

    const first = await getPowerRankingsRealData();
    const second = await getPowerRankingsRealData();
    expect(second).toBe(first);
  });

  it("excludes a row strictly before the canonical window from the resulting team states", async () => {
    rootDir = await mkdtemp(join(tmpdir(), "power-rankings-repo-test-"));
    const featuresDir = join(rootDir, "features");
    const curatedDir = join(rootDir, "curated");
    await mkdir(featuresDir, { recursive: true });
    await mkdir(curatedDir, { recursive: true });
    await writeFile(join(featuresDir, "feature-manifest.json"), JSON.stringify({ featureDatasetVersion: "fixture-v1" }), "utf-8");
    await writeFile(join(featuresDir, "feature-rows.json"), JSON.stringify([buildFixtureRow({ scheduledAt: "2025-01-01T00:00:00.000Z" })]), "utf-8");
    await writeFile(
      join(featuresDir, "canonical-window.json"),
      JSON.stringify({ windowStartIso: "2025-06-07T12:00:00.000Z", sourceEventInternalId: "vlr:event:2282", sourceEventName: "Valorant Masters Toronto 2025" }),
      "utf-8",
    );
    await writeFile(join(curatedDir, "identity-mappings.json"), JSON.stringify({ teamMapping: [] }), "utf-8");
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = rootDir;

    const result = await getPowerRankingsRealData();
    expect(result!.states.size).toBe(0);
  });
});
