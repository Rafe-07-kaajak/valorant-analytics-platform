import { describe, expect, it } from "vitest";
import { buildCuratedMatch } from "../testUtils/curatedMatchFixture";
import type { NormalizedEvent } from "../normalize/normalizedSchemas";
import { buildCurrentMatchupRow } from "./currentMatchupRow";
import { DEFAULT_ELO_CONFIG } from "./versions";

function buildEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
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

const ASOF = "2026-01-01T00:00:00.000Z";
const BASE_CONTEXT = { asOfIso: ASOF, seriesFormat: "bo3", tournamentTier: "league" as const, eventRegion: "americas" };

describe("buildCurrentMatchupRow", () => {
  it("builds a valid row for two teams with real match history", () => {
    const event = buildEvent();
    const eventsById = new Map([[event.internalId, event]]);
    const match = buildCuratedMatch({
      internalId: "vlr:match:1",
      teamAId: "team-a",
      teamBId: "team-b",
      winnerId: "team-a",
      eventId: event.internalId,
      scheduledAt: { iso: "2025-06-01T00:00:00.000Z", raw: "r", confidence: "high" },
    });

    const row = buildCurrentMatchupRow([match], eventsById, "team-a", "team-b", BASE_CONTEXT, DEFAULT_ELO_CONFIG, "src-v1");

    expect(row.teamAProviderId).toBe("team-a");
    expect(row.teamBProviderId).toBe("team-b");
    expect(row.scheduledAt).toBe(ASOF);
    expect(row.teamAPriorMatchCount).toBe(1);
    expect(row.teamAPriorWins).toBe(1);
    expect(row.teamBPriorMatchCount).toBe(1);
    expect(row.teamBPriorWins).toBe(0);
  });

  it("gives a team with zero real match history an honest cold-start row, not a fabricated one", () => {
    const event = buildEvent();
    const eventsById = new Map([[event.internalId, event]]);
    const match = buildCuratedMatch({ internalId: "vlr:match:1", teamAId: "team-a", teamBId: "team-c", winnerId: "team-a", eventId: event.internalId });

    const row = buildCurrentMatchupRow([match], eventsById, "brand-new-team", "another-new-team", BASE_CONTEXT, DEFAULT_ELO_CONFIG, "src-v1");

    expect(row.teamAIsColdStart).toBe(true);
    expect(row.teamBIsColdStart).toBe(true);
    expect(row.teamAEloRating).toBe(DEFAULT_ELO_CONFIG.initialRating);
    expect(row.teamBEloRating).toBe(DEFAULT_ELO_CONFIG.initialRating);
  });

  it("computes real head-to-head history between exactly the requested pair", () => {
    const event = buildEvent();
    const eventsById = new Map([[event.internalId, event]]);
    const priorMeeting = buildCuratedMatch({
      internalId: "vlr:match:1",
      teamAId: "team-a",
      teamBId: "team-b",
      winnerId: "team-a",
      eventId: event.internalId,
      scheduledAt: { iso: "2025-06-01T00:00:00.000Z", raw: "r", confidence: "high" },
    });

    const row = buildCurrentMatchupRow([priorMeeting], eventsById, "team-a", "team-b", BASE_CONTEXT, DEFAULT_ELO_CONFIG, "src-v1");
    expect(row.h2hPriorMeetingCount).toBe(1);
    expect(row.h2hTeamAWins).toBe(1);

    const rowNoHistory = buildCurrentMatchupRow([priorMeeting], eventsById, "team-a", "team-x", BASE_CONTEXT, DEFAULT_ELO_CONFIG, "src-v1");
    expect(rowNoHistory.h2hPriorMeetingCount).toBe(0);
  });

  it("reports zero event congestion — no real event is actually scheduled", () => {
    const event = buildEvent();
    const eventsById = new Map([[event.internalId, event]]);
    const match = buildCuratedMatch({ internalId: "vlr:match:1", teamAId: "team-a", teamBId: "team-b", winnerId: "team-a", eventId: event.internalId });

    const row = buildCurrentMatchupRow([match], eventsById, "team-a", "team-b", BASE_CONTEXT, DEFAULT_ELO_CONFIG, "src-v1");
    expect(row.eventStageMatchesLast3Days).toBe(0);
  });

  it("sets tournament-tier fields directly from the caller's explicit context, never guessing", () => {
    const event = buildEvent();
    const eventsById = new Map([[event.internalId, event]]);
    const match = buildCuratedMatch({ internalId: "vlr:match:1", teamAId: "team-a", teamBId: "team-b", winnerId: "team-a", eventId: event.internalId });

    const leagueRow = buildCurrentMatchupRow([match], eventsById, "team-a", "team-b", { ...BASE_CONTEXT, tournamentTier: "league", eventRegion: "pacific" }, DEFAULT_ELO_CONFIG, "src-v1");
    expect(leagueRow.isRegionalLeague).toBe(true);
    expect(leagueRow.isInternationalEvent).toBe(false);
    expect(leagueRow.isMastersOrChampions).toBe(false);
    expect(leagueRow.eventRegion).toBe("pacific");
    expect(leagueRow.eventFamily).toBe("vct-pacific");

    const internationalRow = buildCurrentMatchupRow([match], eventsById, "team-a", "team-b", { ...BASE_CONTEXT, tournamentTier: "international" }, DEFAULT_ELO_CONFIG, "src-v1");
    expect(internationalRow.isInternationalEvent).toBe(true);
    expect(internationalRow.isMastersOrChampions).toBe(true);
    // "unknown", not "international" — matches how every real Masters/Champions
    // training row is actually encoded (vlr.gg carries no region tag for
    // international events); "international" was never a trained vocabulary value.
    expect(internationalRow.eventRegion).toBe("unknown");
  });

  it("normalizes seriesFormat the same way real ingested matches are normalized, regardless of caller casing", () => {
    const event = buildEvent();
    const eventsById = new Map([[event.internalId, event]]);
    const match = buildCuratedMatch({ internalId: "vlr:match:1", teamAId: "team-a", teamBId: "team-b", winnerId: "team-a", eventId: event.internalId });

    const upper = buildCurrentMatchupRow([match], eventsById, "team-a", "team-b", { ...BASE_CONTEXT, seriesFormat: "BO3" }, DEFAULT_ELO_CONFIG, "src-v1");
    expect(upper.seriesFormat).toBe("bo3");

    const upperBo5 = buildCurrentMatchupRow([match], eventsById, "team-a", "team-b", { ...BASE_CONTEXT, seriesFormat: "BO5" }, DEFAULT_ELO_CONFIG, "src-v1");
    expect(upperBo5.seriesFormat).toBe("bo5");

    const alreadyLower = buildCurrentMatchupRow([match], eventsById, "team-a", "team-b", { ...BASE_CONTEXT, seriesFormat: "bo3" }, DEFAULT_ELO_CONFIG, "src-v1");
    expect(alreadyLower.seriesFormat).toBe("bo3");
  });

  it("produces only in-vocabulary categorical values for every supported region/tier/format combination", () => {
    const event = buildEvent();
    const eventsById = new Map([[event.internalId, event]]);
    const match = buildCuratedMatch({ internalId: "vlr:match:1", teamAId: "team-a", teamBId: "team-b", winnerId: "team-a", eventId: event.internalId });

    const REAL_EVENT_REGION_VOCABULARY = ["americas", "china", "emea", "pacific", "unknown"];
    const REAL_EVENT_FAMILY_VOCABULARY = ["champions", "masters", "vct-americas", "vct-china", "vct-emea", "vct-pacific"];
    const REAL_SERIES_FORMAT_VOCABULARY = ["bo3", "bo5"];
    const REAL_TOURNAMENT_LEVEL_VOCABULARY = ["international", "league"];
    const REAL_EVENT_STAGE_VOCABULARY = ["Kickoff", "Masters", "Stage 1", "unknown"];

    const regions = ["americas", "china", "emea", "pacific"] as const;
    const formats = ["BO3", "BO5"] as const;

    for (const eventRegion of regions) {
      for (const seriesFormat of formats) {
        const row = buildCurrentMatchupRow([match], eventsById, "team-a", "team-b", { asOfIso: ASOF, seriesFormat, tournamentTier: "league", eventRegion }, DEFAULT_ELO_CONFIG, "src-v1");
        expect(REAL_EVENT_REGION_VOCABULARY).toContain(row.eventRegion);
        expect(REAL_EVENT_FAMILY_VOCABULARY).toContain(row.eventFamily);
        expect(REAL_SERIES_FORMAT_VOCABULARY).toContain(row.seriesFormat);
        expect(REAL_TOURNAMENT_LEVEL_VOCABULARY).toContain(row.tournamentLevel);
        expect(REAL_EVENT_STAGE_VOCABULARY).toContain(row.eventStage);
      }
    }

    for (const seriesFormat of formats) {
      const row = buildCurrentMatchupRow([match], eventsById, "team-a", "team-b", { asOfIso: ASOF, seriesFormat, tournamentTier: "international", eventRegion: "americas" }, DEFAULT_ELO_CONFIG, "src-v1");
      expect(REAL_EVENT_REGION_VOCABULARY).toContain(row.eventRegion);
      expect(REAL_EVENT_FAMILY_VOCABULARY).toContain(row.eventFamily);
      expect(REAL_SERIES_FORMAT_VOCABULARY).toContain(row.seriesFormat);
      expect(REAL_TOURNAMENT_LEVEL_VOCABULARY).toContain(row.tournamentLevel);
      expect(REAL_EVENT_STAGE_VOCABULARY).toContain(row.eventStage);
    }
  });

  it("is deterministic: identical inputs produce an identical row", () => {
    const event = buildEvent();
    const eventsById = new Map([[event.internalId, event]]);
    const match = buildCuratedMatch({ internalId: "vlr:match:1", teamAId: "team-a", teamBId: "team-b", winnerId: "team-a", eventId: event.internalId });

    const first = buildCurrentMatchupRow([match], eventsById, "team-a", "team-b", BASE_CONTEXT, DEFAULT_ELO_CONFIG, "src-v1");
    const second = buildCurrentMatchupRow([match], eventsById, "team-a", "team-b", BASE_CONTEXT, DEFAULT_ELO_CONFIG, "src-v1");
    expect(second).toEqual(first);
  });

  it("never mutates its input matches/events across repeated calls (no state leakage between requests)", () => {
    const event = buildEvent();
    const eventsById = new Map([[event.internalId, event]]);
    const match = buildCuratedMatch({ internalId: "vlr:match:1", teamAId: "team-a", teamBId: "team-b", winnerId: "team-a", eventId: event.internalId });

    buildCurrentMatchupRow([match], eventsById, "team-a", "team-b", BASE_CONTEXT, DEFAULT_ELO_CONFIG, "src-v1");
    const row = buildCurrentMatchupRow([match], eventsById, "team-a", "team-b", BASE_CONTEXT, DEFAULT_ELO_CONFIG, "src-v1");
    expect(row.teamAPriorMatchCount).toBe(1);
  });
});
