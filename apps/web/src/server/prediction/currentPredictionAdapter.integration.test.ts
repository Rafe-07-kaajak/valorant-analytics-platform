import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PredictionService, type ModelInferenceConfig } from "@repo/model-inference";
import { buildFixtureArtifact, ELO_FIXTURE_MODEL } from "@repo/model-inference/testFixtures";
import { FEATURE_RULES_VERSION, FEATURE_SCHEMA_VERSION } from "@repo/vlr-ingestion";
import { predictCurrentMatch } from "./currentPredictionAdapter";
import { setModelServiceForTesting } from "./modelService";
import { resetCurrentMatchupRepositoryCacheForTesting } from "./currentMatchupRepository";
import { resetPowerRankingsRepositoryCacheForTesting } from "./powerRankingsRepository";

function fixtureModelInferenceConfig(artifactDir: string): ModelInferenceConfig {
  return {
    artifactDir,
    expectedModelVersion: undefined,
    expectedFeatureSchemaVersion: undefined,
    loadOnStart: true,
    requireModelOnStart: false,
    strictHashValidation: true,
    probabilityClipEpsilon: 1e-15,
    maxRequestBytes: 262_144,
    reloadEnabled: false,
    reloadIntervalMs: undefined,
    fallbackPolicy: "disabled",
    fallbackConstantProbability: 0.5,
    inferenceTimeoutMs: 5_000,
    loggingMode: "safe",
    maxArtifactFileBytes: 10_000_000,
  };
}

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
    teamAId: "g2-esports",
    teamBId: "fnatic",
    teamADisplayName: "G2 Esports",
    teamBDisplayName: "Fnatic",
    matchStageDisplay: "Group Stage",
    winnerId: "g2-esports",
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

async function writeFixtureRootDataset(rootDir: string): Promise<void> {
  const curatedDir = join(rootDir, "curated");
  const featuresDir = join(rootDir, "features");
  await mkdir(curatedDir, { recursive: true });
  await mkdir(featuresDir, { recursive: true });

  await writeFile(join(curatedDir, "matches.json"), JSON.stringify([buildFixtureMatch()]), "utf-8");
  await writeFile(join(curatedDir, "events.json"), JSON.stringify([buildFixtureEvent()]), "utf-8");
  await writeFile(join(curatedDir, "dataset-manifest.json"), JSON.stringify({ curatedDatasetVersion: "fixture-curated-v1" }), "utf-8");
  await writeFile(
    join(curatedDir, "identity-mappings.json"),
    JSON.stringify({ teamMapping: [{ internalTeamId: "g2-esports", status: "verified" }, { internalTeamId: "fnatic", status: "verified" }] }),
    "utf-8",
  );

  await writeFile(join(featuresDir, "feature-manifest.json"), JSON.stringify({ featureDatasetVersion: "fixture-feature-v1" }), "utf-8");
  await writeFile(
    join(featuresDir, "feature-rows.json"),
    JSON.stringify([
      {
        matchInternalId: "vlr:match:1",
        scheduledAt: "2025-06-01T00:00:00.000Z",
        teamAProviderId: "g2-esports",
        teamBProviderId: "fnatic",
        teamAEloRating: 1600,
        teamBEloRating: 1500,
        teamALast10WinRate: 0.7,
        teamALast10MatchCount: 5,
        teamBLast10WinRate: 0.4,
        teamBLast10MatchCount: 5,
        teamACumulativeWinRate: 0.6,
        teamBCumulativeWinRate: 0.4,
        teamAMapPoolBreadth: 5,
        teamBMapPoolBreadth: 4,
        teamARecentMapWinRateLast10: 0.6,
        teamBRecentMapWinRateLast10: 0.5,
        teamAAvgRoundsWonPerMap: 8,
        teamBAvgRoundsWonPerMap: 6,
        teamAAvgOpponentEloLast10: 1500,
        teamBAvgOpponentEloLast10: 1500,
        isMastersOrChampions: false,
        isInternationalEvent: false,
        isRegionalLeague: true,
      },
    ]),
    "utf-8",
  );
  await writeFile(
    join(featuresDir, "canonical-window.json"),
    JSON.stringify({ windowStartIso: "2025-06-01T00:00:00.000Z", sourceEventInternalId: "vlr:event:100", sourceEventName: "Fixture Event" }),
    "utf-8",
  );
}

describe("predictCurrentMatch (integration, fixture artifact + fixture curated dataset)", () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    resetCurrentMatchupRepositoryCacheForTesting();
    resetPowerRankingsRepositoryCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
    delete process.env.REAL_PREDICTION_ENABLED;
  });

  afterEach(async () => {
    setModelServiceForTesting(null);
    resetCurrentMatchupRepositoryCacheForTesting();
    resetPowerRankingsRepositoryCacheForTesting();
    delete process.env.REAL_PREDICTION_FEATURE_DATA_DIR;
    delete process.env.REAL_PREDICTION_ENABLED;
    for (const dir of tempDirs.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  async function setUpReadyFixture() {
    const artifact = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, featureContractOverrides: { featureSchemaVersion: FEATURE_SCHEMA_VERSION, featureRulesVersion: FEATURE_RULES_VERSION } });
    tempDirs.push(artifact.rootDir);
    const service = new PredictionService(fixtureModelInferenceConfig(artifact.artifactDir));
    await service.start();
    setModelServiceForTesting(service);

    const rootDir = await mkdtemp(join(tmpdir(), "current-prediction-fixture-"));
    tempDirs.push(rootDir);
    await writeFixtureRootDataset(rootDir);
    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = rootDir;
  }

  it("produces a real-model prediction for two known real teams", async () => {
    await setUpReadyFixture();

    const result = await predictCurrentMatch({
      teamAId: "g2-esports",
      teamBId: "fnatic",
      seriesFormat: "BO3",
      tournamentTier: "international",
      eventRegion: undefined,
      requestId: "req-1",
    });

    expect(result.mode).toBe("current-real-model");
    expect(result.teamAId).toBe("g2-esports");
    expect(result.teamBId).toBe("fnatic");
    expect(result.estimatorType).toBe("elo-baseline");
    expect(result.teamAWinProbability).toBeGreaterThan(0);
    expect(result.teamBWinProbability).toBeGreaterThan(0);
    expect(result.dataProvenance.constructedFromRealFeatureData).toBe(true);
    expect(result.dataProvenance.asOfIso).toBe("2025-06-01T00:00:00.000Z");
    expect(result.teamAConfidence.confidence).toBeDefined();

    // UX-parity task: real team-state/explainability fields, all derived from
    // the same row the model was actually scored against.
    expect(result.teamAState.teamId).toBe("g2-esports");
    expect(result.teamBState.teamId).toBe("fnatic");
    expect(result.contribution.isSoleDriver).toBe(true);
    expect(result.contribution.driverLabel).toBe("Elo rating differential");
    expect(result.contribution.finalProbability).toBe(result.teamAWinProbability);
    expect(result.supportingContext).toHaveLength(6);
    for (const factor of result.supportingContext) {
      expect(factor.isDirectModelInput).toBe(false);
    }
    expect(result.evidenceTrust.score).toBeGreaterThanOrEqual(0);
    expect(result.evidenceTrust.score).toBeLessThanOrEqual(100);
    expect(result.headToHead.priorMeetingCount).toBeGreaterThanOrEqual(0);
    expect(["sufficient", "limited", "none"]).toContain(result.mapEvidence.evidenceLevel);
    expect(result.pipeline).toHaveLength(11);
    expect(result.pipeline.filter((stage) => stage.durationMs !== null)).toHaveLength(1);
  });

  it("rejects an unknown team id with request_invalid", async () => {
    await setUpReadyFixture();
    await expect(
      predictCurrentMatch({ teamAId: "not-a-real-team", teamBId: "fnatic", seriesFormat: "BO3", tournamentTier: "international", eventRegion: undefined }),
    ).rejects.toMatchObject({ code: "request_invalid" });
  });

  it("rejects the same team on both sides", async () => {
    await setUpReadyFixture();
    await expect(
      predictCurrentMatch({ teamAId: "g2-esports", teamBId: "g2-esports", seriesFormat: "BO3", tournamentTier: "international", eventRegion: undefined }),
    ).rejects.toMatchObject({ code: "request_invalid" });
  });

  it("rejects a league-tier matchup between teams from different real regions", async () => {
    await setUpReadyFixture();
    // g2-esports (EMEA) vs a Pacific team — different real regions, league tier is invalid without international.
    await expect(
      predictCurrentMatch({ teamAId: "g2-esports", teamBId: "paper-rex", seriesFormat: "BO3", tournamentTier: "league", eventRegion: undefined }),
    ).rejects.toMatchObject({ code: "request_invalid" });
  });

  it("reports current_matchup_data_unavailable when the curated dataset is missing, independent of model readiness", async () => {
    const artifact = await buildFixtureArtifact({ model: ELO_FIXTURE_MODEL, featureContractOverrides: { featureSchemaVersion: FEATURE_SCHEMA_VERSION, featureRulesVersion: FEATURE_RULES_VERSION } });
    tempDirs.push(artifact.rootDir);
    const service = new PredictionService(fixtureModelInferenceConfig(artifact.artifactDir));
    await service.start();
    setModelServiceForTesting(service);

    process.env.REAL_PREDICTION_FEATURE_DATA_DIR = "/nonexistent-directory-for-tests";

    await expect(
      predictCurrentMatch({ teamAId: "g2-esports", teamBId: "fnatic", seriesFormat: "BO3", tournamentTier: "international", eventRegion: undefined }),
    ).rejects.toMatchObject({ code: "current_matchup_data_unavailable" });
  });

  it("rejects with model_unavailable when REAL_PREDICTION_ENABLED=false, even though data is ready", async () => {
    await setUpReadyFixture();
    process.env.REAL_PREDICTION_ENABLED = "false";
    await expect(
      predictCurrentMatch({ teamAId: "g2-esports", teamBId: "fnatic", seriesFormat: "BO3", tournamentTier: "international", eventRegion: undefined }),
    ).rejects.toMatchObject({ code: "model_unavailable" });
  });

  it("is deterministic across repeated calls for the same matchup", async () => {
    await setUpReadyFixture();
    const first = await predictCurrentMatch({ teamAId: "g2-esports", teamBId: "fnatic", seriesFormat: "BO3", tournamentTier: "international", eventRegion: undefined });
    const second = await predictCurrentMatch({ teamAId: "g2-esports", teamBId: "fnatic", seriesFormat: "BO3", tournamentTier: "international", eventRegion: undefined });
    expect(second.teamAWinProbability).toBe(first.teamAWinProbability);
    expect(second.predictedWinnerSide).toBe(first.predictedWinnerSide);
  });

  describe("categorical vocabulary regression (bug fix verification)", () => {
    // Mirrors the real shipped feature-contract's categorical vocabulary
    // (services/*/. local/**/feature-contract.json) rather than the fixture
    // package's minimal default (which only declares `eventFamily`), so this
    // test exercises the exact `__unknown__`-bucket warning path a real
    // deployment would hit for eventRegion/seriesFormat/tournamentLevel.
    const REAL_SHAPED_CATEGORICAL_VOCABULARY = {
      eventFamily: ["champions", "masters", "vct-americas", "vct-china", "vct-emea", "vct-pacific"],
      eventRegion: ["americas", "china", "emea", "pacific", "unknown"],
      eventStage: ["Kickoff", "Masters", "Stage 1", "unknown"],
      seriesFormat: ["bo3", "bo5"],
      tournamentLevel: ["international", "league"],
    };
    const REAL_SHAPED_CATEGORICAL_FIELDS = Object.keys(REAL_SHAPED_CATEGORICAL_VOCABULARY);

    async function setUpRealShapedVocabularyFixture() {
      const artifact = await buildFixtureArtifact({
        model: ELO_FIXTURE_MODEL,
        featureContractOverrides: {
          featureSchemaVersion: FEATURE_SCHEMA_VERSION,
          featureRulesVersion: FEATURE_RULES_VERSION,
          categoricalFields: REAL_SHAPED_CATEGORICAL_FIELDS,
          categoricalVocabulary: REAL_SHAPED_CATEGORICAL_VOCABULARY,
          requiredInputFields: ["teamAEloWinProbability", "teamAEloRating", "teamBEloRating", "teamADaysSinceLastMatch", "teamAHasPriorMatch", ...REAL_SHAPED_CATEGORICAL_FIELDS],
        },
      });
      tempDirs.push(artifact.rootDir);
      const service = new PredictionService(fixtureModelInferenceConfig(artifact.artifactDir));
      await service.start();
      setModelServiceForTesting(service);

      const rootDir = await mkdtemp(join(tmpdir(), "current-prediction-fixture-"));
      tempDirs.push(rootDir);
      await writeFixtureRootDataset(rootDir);
      process.env.REAL_PREDICTION_FEATURE_DATA_DIR = rootDir;
    }

    function hasVocabularyWarning(warnings: readonly string[]): boolean {
      return warnings.some((warning) => warning.includes("not in the training vocabulary"));
    }

    it("never falls into the __unknown__ bucket for a regional-league matchup", async () => {
      await setUpRealShapedVocabularyFixture();
      // g2-esports and 100-thieves are both Americas in the real team registry.
      const result = await predictCurrentMatch({ teamAId: "g2-esports", teamBId: "100-thieves", seriesFormat: "BO3", tournamentTier: "league", eventRegion: undefined });
      expect(hasVocabularyWarning(result.warnings)).toBe(false);
    });

    it("never falls into the __unknown__ bucket for an international matchup, for either supported series format", async () => {
      await setUpRealShapedVocabularyFixture();
      const bo3 = await predictCurrentMatch({ teamAId: "g2-esports", teamBId: "fnatic", seriesFormat: "BO3", tournamentTier: "international", eventRegion: undefined });
      expect(hasVocabularyWarning(bo3.warnings)).toBe(false);

      const bo5 = await predictCurrentMatch({ teamAId: "g2-esports", teamBId: "fnatic", seriesFormat: "BO5", tournamentTier: "international", eventRegion: undefined });
      expect(hasVocabularyWarning(bo5.warnings)).toBe(false);
    });
  });
});
