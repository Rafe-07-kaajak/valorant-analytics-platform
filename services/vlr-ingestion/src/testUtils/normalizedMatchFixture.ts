import type { NormalizedMatch } from "../normalize/normalizedSchemas";

/**
 * Shared test-only builder for a minimal, valid `NormalizedMatch` — used
 * across TASK-043's quality/reconciliation/curation test suites so each
 * test only needs to override the fields it actually cares about.
 */
export function buildNormalizedMatch(overrides: Partial<NormalizedMatch> = {}): NormalizedMatch {
  const base: NormalizedMatch = {
    internalId: "vlr:match:1",
    teamAId: "fnatic",
    teamBId: "team-liquid",
    winnerId: "fnatic",
    scheduledAt: { iso: "2025-06-01T12:00:00.000Z", raw: "raw", confidence: "high" },
    status: "completed",
    seriesFormat: "bo3",
    eventId: "vlr:event:1",
    maps: [
      { map: { name: "Ascent", raw: "Ascent", recognized: true }, order: 1, teamAScore: 13, teamBScore: 7, winnerInternalTeamId: "fnatic", overtime: false, qualityFlags: [] },
      { map: { name: "Bind", raw: "Bind", recognized: true }, order: 2, teamAScore: 13, teamBScore: 10, winnerInternalTeamId: "fnatic", overtime: false, qualityFlags: [] },
    ],
    rosterSnapshots: [
      { teamInternalId: "fnatic", asOf: "2025-06-01T12:00:00.000Z", playerInternalIds: ["vlr:player:1", "vlr:player:2", "vlr:player:3", "vlr:player:4", "vlr:player:5"] },
      { teamInternalId: "team-liquid", asOf: "2025-06-01T12:00:00.000Z", playerInternalIds: ["vlr:player:6", "vlr:player:7", "vlr:player:8", "vlr:player:9", "vlr:player:10"] },
    ],
    sourceReference: { provider: "vlr", externalId: "1", sourceUrl: "https://www.vlr.gg/1" },
    trainingEligibility: { eligible: true, reasons: [] },
    qualityFlags: [],
    metadata: { provider: "vlr", providerExternalId: "1", sourceUrl: "https://www.vlr.gg/1", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "hash1" },
  };
  return { ...base, ...overrides };
}
