import { describe, expect, it } from "vitest";
import { normalizeMatch } from "./normalizeMatch";
import type { VlrMatchDetail } from "../vlr/schemas/raw";
import type { NormalizedEvent } from "./normalizedSchemas";

const APPROVED_EVENT: NormalizedEvent = {
  internalId: "vlr:event:2001",
  name: "VCT 2025: Americas Stage 1",
  status: "completed",
  startDate: { iso: "2025-01-01T00:00:00.000Z", raw: "2025-01-01", confidence: "high" },
  endDate: { iso: "2025-03-01T00:00:00.000Z", raw: "2025-03-01", confidence: "high" },
  tournamentLevel: "league",
  eventFamily: "vct-americas",
  classification: { classification: "vct-americas", confidence: "high", reason: "test", evidence: [] },
  metadata: {
    provider: "vlr",
    providerExternalId: "2001",
    sourceUrl: "https://www.vlr.gg/event/2001",
    fetchedAt: "t",
    parsedAt: "t",
    schemaVersion: "1.0.0",
    contentHash: "hash",
  },
};

const RAW_MATCH: VlrMatchDetail = {
  vlrMatchId: "347540",
  matchUrl: "https://www.vlr.gg/347540/fnatic-vs-team-liquid",
  teamAVlrTeamId: "2593",
  teamBVlrTeamId: "2594",
  winnerVlrTeamId: "2593",
  seriesFormatRaw: "Bo3",
  maps: [
    { mapNameRaw: "Ascent", order: 1, teamAScore: 13, teamBScore: 9, winnerVlrTeamId: "2593", overtime: false },
    { mapNameRaw: "Bind", order: 2, teamAScore: 10, teamBScore: 13, winnerVlrTeamId: "2594", overtime: false },
    { mapNameRaw: "Lotus", order: 3, teamAScore: 15, teamBScore: 13, winnerVlrTeamId: "2593", overtime: true },
  ],
  vlrEventId: "2001",
  status: "completed",
  scheduledAtRaw: "2025-01-15T18:00:00.000Z",
  scheduledAtIso: "2025-01-15T18:00:00.000Z",
  source: { sourceUrl: "https://www.vlr.gg/347540/fnatic-vs-team-liquid", fetchedAt: "2026-07-18T00:00:00.000Z", parserVersion: "vlr-parsers@1.0.0" },
};

function baseInput(overrides: Partial<Parameters<typeof normalizeMatch>[0]> = {}) {
  return {
    raw: RAW_MATCH,
    teamAIdentity: { internalId: "fnatic", mapped: true },
    teamBIdentity: { internalId: "team-liquid", mapped: true },
    event: APPROVED_EVENT,
    scopeStartDate: "2025-01-01",
    scopeEndDate: "2026-07-18",
    isDuplicate: false,
    isShowmatch: false,
    parsedAt: "2026-07-18T00:01:00.000Z",
    ...overrides,
  };
}

describe("normalizeMatch — happy path", () => {
  it("resolves the winner to the mapped internal team ID", () => {
    const result = normalizeMatch(baseInput());
    expect(result.winnerId).toBe("fnatic");
  });

  it("is training-eligible for a clean, completed, in-scope, approved-family match", () => {
    const result = normalizeMatch(baseInput());
    expect(result.trainingEligibility.eligible).toBe(true);
  });

  it("normalizes the series format and preserves map order", () => {
    const result = normalizeMatch(baseInput());
    expect(result.seriesFormat).toBe("bo3");
    expect(result.maps.map((m) => m.map.name)).toEqual(["Ascent", "Bind", "Lotus"]);
  });

  it("is idempotent for the same input", () => {
    const first = normalizeMatch(baseInput());
    const second = normalizeMatch(baseInput());
    expect(first).toEqual(second);
  });
});

describe("normalizeMatch — quality flags", () => {
  it("flags an unmapped team", () => {
    const result = normalizeMatch(baseInput({ teamAIdentity: { internalId: "vlr:team:2593", mapped: false } }));
    expect(result.qualityFlags.some((f) => f.code === "missing_team_mapping")).toBe(true);
  });

  it("flags a missing series format", () => {
    const raw = { ...RAW_MATCH, seriesFormatRaw: undefined };
    const result = normalizeMatch(baseInput({ raw }));
    expect(result.qualityFlags.some((f) => f.code === "missing_series_format")).toBe(true);
  });

  it("flags an unrecognized map name without remapping it", () => {
    const raw = { ...RAW_MATCH, maps: [{ ...RAW_MATCH.maps[0]!, mapNameRaw: "Corrode" }] };
    const result = normalizeMatch(baseInput({ raw }));
    expect(result.maps[0]?.map.name).toBe("Corrode");
    expect(result.maps[0]?.qualityFlags.some((f) => f.code === "unknown_map")).toBe(true);
  });

  it("flags a match tied to an unknown-classification event and marks it ineligible", () => {
    const unknownEvent: NormalizedEvent = { ...APPROVED_EVENT, eventFamily: "unknown", classification: { ...APPROVED_EVENT.classification, classification: "unknown" } };
    const result = normalizeMatch(baseInput({ event: unknownEvent }));
    expect(result.qualityFlags.some((f) => f.code === "unknown_event_classification")).toBe(true);
    expect(result.trainingEligibility.eligible).toBe(false);
  });

  it("flags an excluded-category event", () => {
    const excludedEvent: NormalizedEvent = { ...APPROVED_EVENT, eventFamily: "excluded-showmatch" };
    const result = normalizeMatch(baseInput({ event: excludedEvent }));
    expect(result.qualityFlags.some((f) => f.code === "excluded_event_category")).toBe(true);
  });

  it("flags a duplicate match", () => {
    const result = normalizeMatch(baseInput({ isDuplicate: true }));
    expect(result.qualityFlags.some((f) => f.code === "duplicate_match")).toBe(true);
    expect(result.trainingEligibility.eligible).toBe(false);
  });
});
