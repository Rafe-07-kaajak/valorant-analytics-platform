import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildQualityReport } from "./qualityReport";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import type { EventDiscoveryManifest, EventManifestEntry } from "./eventManifest";
import type { MatchDiscoveryManifest, MatchManifestEntry } from "./matchManifest";
import type { NormalizedMatch } from "../normalize/normalizedSchemas";

function eventEntry(overrides: Partial<EventManifestEntry>): EventManifestEntry {
  return {
    vlrEventId: "1",
    name: "Event",
    sourceUrl: "https://www.vlr.gg/event/1",
    tournamentLevel: "league",
    classification: "vct-americas",
    confidence: "high",
    evidence: [],
    inclusionStatus: "included",
    discoveredAt: "t",
    ...overrides,
  };
}

function matchEntry(overrides: Partial<MatchManifestEntry>): MatchManifestEntry {
  return {
    vlrMatchId: "1",
    eventId: "1",
    eventFamily: "vct-americas",
    matchUrl: "https://www.vlr.gg/1",
    listedStatus: "completed",
    discoverySourceUrl: "https://www.vlr.gg/event/matches/1",
    discoveryTimestamp: "t",
    detailFetchStatus: "pending",
    ...overrides,
  };
}

function normalizedMatch(overrides: Partial<NormalizedMatch> = {}): NormalizedMatch {
  return {
    internalId: "vlr:match:1",
    teamAId: "fnatic",
    teamBId: "vlr:team:2594",
    winnerId: "fnatic",
    scheduledAt: { iso: "2025-01-15T18:00:00.000Z", raw: "r", confidence: "high" },
    status: "completed",
    seriesFormat: "bo3",
    eventId: "vlr:event:1",
    maps: [{ map: { name: "Ascent", raw: "Ascent", recognized: true }, order: 1, teamAScore: 13, teamBScore: 9, overtime: false, qualityFlags: [] }],
    sourceReference: { provider: "vlr", externalId: "1", sourceUrl: "https://www.vlr.gg/1" },
    trainingEligibility: { eligible: true, reasons: [] },
    qualityFlags: [],
    metadata: { provider: "vlr", providerExternalId: "1", sourceUrl: "https://www.vlr.gg/1", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h" },
    ...overrides,
  };
}

let rootDir: string;
let store: FilesystemIngestionStore;

beforeEach(async () => {
  rootDir = await mkdtemp(join(tmpdir(), "vlr-quality-report-test-"));
  store = new FilesystemIngestionStore(rootDir);
});

afterEach(async () => {
  await store._clearForTests();
});

describe("buildQualityReport", () => {
  it("aggregates counts by year, event family, series format, and map", async () => {
    await store.upsertNormalizedEntity("match", "vlr:match:1", normalizedMatch());
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [eventEntry({})] };
    const matchManifest: MatchDiscoveryManifest = { generatedAt: "t", entries: [matchEntry({})], duplicateMatchLinks: 0, eventsWithFailedDiscovery: [] };

    const report = await buildQualityReport(store, eventManifest, matchManifest);
    expect(report.totalNormalizedMatches).toBe(1);
    expect(report.trainingEligibleMatches).toBe(1);
    expect(report.recordsByYear["2025"]).toBe(1);
    expect(report.recordsByEventFamily["vct-americas"]).toBe(1);
    expect(report.recordsBySeriesFormat.bo3).toBe(1);
    expect(report.recordsByMap.Ascent).toBe(1);
    expect(report.percentTrainingEligible).toBe(100);
  });

  it("counts a missing winner, ambiguous timestamp, and unknown map", async () => {
    await store.upsertNormalizedEntity(
      "match",
      "vlr:match:1",
      normalizedMatch({
        winnerId: null,
        scheduledAt: { iso: null, raw: "r", confidence: "none" },
        maps: [{ map: { name: "Fizzbin", raw: "Fizzbin", recognized: false }, order: 1, teamAScore: 13, teamBScore: 9, overtime: false, qualityFlags: [] }],
      }),
    );
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [eventEntry({})] };
    const matchManifest: MatchDiscoveryManifest = { generatedAt: "t", entries: [matchEntry({})], duplicateMatchLinks: 0, eventsWithFailedDiscovery: [] };

    const report = await buildQualityReport(store, eventManifest, matchManifest);
    expect(report.missingWinner).toBe(1);
    expect(report.ambiguousTimestamps).toBe(1);
    expect(report.unknownMaps).toBe(1);
  });

  it("excludes unmapped team internal IDs from the by-team breakdown", async () => {
    await store.upsertNormalizedEntity("match", "vlr:match:1", normalizedMatch());
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [eventEntry({})] };
    const matchManifest: MatchDiscoveryManifest = { generatedAt: "t", entries: [matchEntry({})], duplicateMatchLinks: 0, eventsWithFailedDiscovery: [] };

    const report = await buildQualityReport(store, eventManifest, matchManifest);
    expect(report.recordsByTeam.fnatic).toBe(1);
    expect(report.recordsByTeam["vlr:team:2594"]).toBeUndefined();
  });

  it("returns zero percentages for an empty dataset without dividing by zero", async () => {
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [] };
    const matchManifest: MatchDiscoveryManifest = { generatedAt: "t", entries: [], duplicateMatchLinks: 0, eventsWithFailedDiscovery: [] };
    const report = await buildQualityReport(store, eventManifest, matchManifest);
    expect(report.percentTrainingEligible).toBe(0);
    expect(report.totalNormalizedMatches).toBe(0);
  });
});
