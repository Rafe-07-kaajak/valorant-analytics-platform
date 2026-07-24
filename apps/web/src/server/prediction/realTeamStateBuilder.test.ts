import { describe, expect, it } from "vitest";
import {
  buildCurrentMatchupRow,
  DEFAULT_ELO_CONFIG,
  type CuratedMatch,
  type CurrentMatchupContext,
  type CurrentMatchupRow,
  type NormalizedEvent,
} from "@repo/vlr-ingestion";
import type { CurrentMatchupTeamConfidence } from "@repo/shared";
import {
  buildEvidenceTrust,
  buildHeadToHead,
  buildMapEvidence,
  buildMatchContribution,
  buildPipelineStages,
  buildSupportingContext,
  buildTeamStateSnapshot,
} from "./realTeamStateBuilder";

function buildEvent(overrides: Record<string, unknown> = {}) {
  return {
    internalId: "vlr:event:100",
    name: "VCT 2025: Americas Stage 1",
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

function buildMatch(overrides: Record<string, unknown> = {}) {
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

/** Team A wins every prior meeting — gives team A a real, non-trivial Elo/form/H2H edge over team B so builder-function assertions aren't all trivially zero. */
function buildRealRow(): CurrentMatchupRow {
  const event = buildEvent() as unknown as NormalizedEvent;
  const eventsById = new Map([[event.internalId, event]]);
  const matches = [1, 2, 3].map(
    (n) =>
      buildMatch({ internalId: `vlr:match:${n}`, scheduledAt: { iso: `2025-0${n}-01T00:00:00.000Z`, raw: "r", confidence: "high" } }) as unknown as CuratedMatch,
  );
  const context: CurrentMatchupContext = { asOfIso: "2026-01-01T00:00:00.000Z", seriesFormat: "BO3", tournamentTier: "league", eventRegion: "americas" };
  return buildCurrentMatchupRow(matches, eventsById, "team-a", "team-b", context, DEFAULT_ELO_CONFIG, "src-v1");
}

const VERIFIED_A: CurrentMatchupTeamConfidence = { teamId: "team-a", confidence: "verified", seriesCountInWindow: 25 };
const PROVISIONAL_B: CurrentMatchupTeamConfidence = { teamId: "team-b", confidence: "provisional", seriesCountInWindow: 2 };

describe("buildTeamStateSnapshot", () => {
  it("reads team A's real state directly off the row, distinctly from team B's", () => {
    const row = buildRealRow();
    const teamA = buildTeamStateSnapshot(row, "teamA", 25);
    const teamB = buildTeamStateSnapshot(row, "teamB", 2);

    expect(teamA.teamId).toBe("team-a");
    expect(teamB.teamId).toBe("team-b");
    expect(teamA.eloRating).toBe(row.teamAEloRating);
    expect(teamB.eloRating).toBe(row.teamBEloRating);
    // Team A won every prior meeting, so it should have strictly higher Elo than team B here.
    expect(teamA.eloRating).toBeGreaterThan(teamB.eloRating);
    expect(teamA.seriesCountInWindow).toBe(25);
    expect(teamB.seriesCountInWindow).toBe(2);
  });
});

describe("buildMatchContribution", () => {
  it("labels Elo as the sole driver for the elo-baseline estimator and reconciles calibration math", () => {
    const row = buildRealRow();
    const finalProbability = 0.62;
    const contribution = buildMatchContribution(row, "elo-baseline", finalProbability);

    expect(contribution.driverLabel).toBe("Elo rating differential");
    expect(contribution.isSoleDriver).toBe(true);
    expect(contribution.driverDifferential).toBe(row.eloRatingDiff);
    expect(contribution.uncalibratedProbability).toBe(row.teamAEloWinProbability);
    expect(contribution.finalProbability).toBe(finalProbability);
    expect(contribution.calibrationAdjustment).toBeCloseTo(finalProbability - row.teamAEloWinProbability, 10);
  });

  it("does not claim sole-driver status for a non-Elo estimator", () => {
    const row = buildRealRow();
    const contribution = buildMatchContribution(row, "logistic-regression", 0.55);
    expect(contribution.isSoleDriver).toBe(false);
    expect(contribution.driverLabel).toContain("logistic-regression");
  });
});

describe("buildSupportingContext", () => {
  it("returns one real, non-driving factor per documented category, all marked isDirectModelInput: false", () => {
    const row = buildRealRow();
    const factors = buildSupportingContext(row);
    const ids = factors.map((f) => f.id);

    expect(ids).toEqual(["recent-form", "opponent-adjusted-strength", "map-pool-breadth", "schedule-strength", "activity-rest", "competition-experience"]);
    for (const factor of factors) {
      expect(factor.isDirectModelInput).toBe(false);
      expect(["teamA", "teamB", "even"]).toContain(factor.favoredSide);
    }
  });

  it("favors team A on recent form when team A's real win rate is strictly higher", () => {
    const row = buildRealRow();
    expect(row.teamALast10WinRate).toBeGreaterThan(row.teamBLast10WinRate);
    const factors = buildSupportingContext(row);
    const recentForm = factors.find((f) => f.id === "recent-form")!;
    expect(recentForm.favoredSide).toBe("teamA");
  });
});

describe("buildEvidenceTrust", () => {
  it("produces a lower score for a provisional/low-sample team than an identical pairing with two verified teams", () => {
    const row = buildRealRow();
    const bothVerified = buildEvidenceTrust(row, VERIFIED_A, { ...PROVISIONAL_B, confidence: "verified", seriesCountInWindow: 25 });
    const oneProvisional = buildEvidenceTrust(row, VERIFIED_A, PROVISIONAL_B);

    expect(oneProvisional.score).toBeLessThan(bothVerified.score);
    expect(oneProvisional.score).toBeGreaterThanOrEqual(0);
    expect(bothVerified.score).toBeLessThanOrEqual(100);
    expect(oneProvisional.explanation).toContain("unverified");
  });

  it("never returns NaN or a value outside [0, 100]", () => {
    const row = buildRealRow();
    const unrated: CurrentMatchupTeamConfidence = { teamId: "team-x", confidence: "unrated", seriesCountInWindow: 0 };
    const trust = buildEvidenceTrust(row, unrated, unrated);
    expect(Number.isNaN(trust.score)).toBe(false);
    expect(trust.score).toBeGreaterThanOrEqual(0);
    expect(trust.score).toBeLessThanOrEqual(100);
  });
});

describe("buildHeadToHead", () => {
  it("reports the real prior-meeting record between exactly these two teams", () => {
    const row = buildRealRow();
    const h2h = buildHeadToHead(row);
    expect(h2h.priorMeetingCount).toBe(row.h2hPriorMeetingCount);
    expect(h2h.teamAWins).toBe(row.h2hTeamAWins);
    expect(h2h.teamBWins).toBe(row.h2hTeamBWins);
  });
});

describe("buildMapEvidence", () => {
  it("marks evidence as 'none' when either team has too few real series, never fabricating a per-map score", () => {
    const row = buildRealRow();
    const evidence = buildMapEvidence(row, 25, 1);
    expect(evidence.evidenceLevel).toBe("none");
    expect(evidence.teamAMapPoolBreadth).toBe(row.teamAMapPoolBreadth);
  });

  it("marks evidence as 'sufficient' when both teams clear the sample-size threshold", () => {
    const row = buildRealRow();
    const evidence = buildMapEvidence(row, 25, 30);
    expect(evidence.evidenceLevel).toBe("sufficient");
  });
});

describe("buildPipelineStages", () => {
  it("attaches the one real measured duration to exactly one stage, leaving every other stage's timing null", () => {
    const stages = buildPipelineStages(12.5);
    const measured = stages.filter((stage) => stage.durationMs !== null);
    expect(measured).toHaveLength(1);
    expect(measured[0]!.id).toBe("run-estimator");
    expect(measured[0]!.durationMs).toBe(12.5);
    expect(stages).toHaveLength(11);
  });
});
