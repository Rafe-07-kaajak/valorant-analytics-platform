import { describe, expect, it } from "vitest";
import { buildPreBackfillReport } from "./preBackfillReport";
import { loadVlrIngestionConfig } from "../env";
import type { EventDiscoveryManifest, EventManifestEntry } from "./eventManifest";
import type { MatchDiscoveryManifest, MatchManifestEntry } from "./matchManifest";

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

const CONFIG = loadVlrIngestionConfig();

describe("buildPreBackfillReport", () => {
  it("counts included events by family and excluded events by reason", () => {
    const eventManifest: EventDiscoveryManifest = {
      scopeStartDate: "2025-01-01",
      scopeEndDate: "2026-07-18",
      generatedAt: "t",
      entries: [
        eventEntry({ vlrEventId: "1", classification: "vct-americas" }),
        eventEntry({ vlrEventId: "2", inclusionStatus: "excluded", exclusionReason: "excluded-tier-2" }),
        eventEntry({ vlrEventId: "3", inclusionStatus: "unknown" }),
      ],
    };
    const matchManifest: MatchDiscoveryManifest = { generatedAt: "t", entries: [], duplicateMatchLinks: 0, eventsWithFailedDiscovery: [] };
    const report = buildPreBackfillReport(eventManifest, matchManifest, CONFIG);

    expect(report.includedEventsByFamily["vct-americas"]).toBe(1);
    expect(report.excludedEventsByReason["excluded-tier-2"]).toBe(1);
    expect(report.unknownEvents).toBe(1);
  });

  it("flags zero included events for an approved family as an anomaly", () => {
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [] };
    const matchManifest: MatchDiscoveryManifest = { generatedAt: "t", entries: [], duplicateMatchLinks: 0, eventsWithFailedDiscovery: [] };
    const report = buildPreBackfillReport(eventManifest, matchManifest, CONFIG);

    expect(report.anomalies.some((a) => a.includes("vct-americas"))).toBe(true);
    expect(report.anomalies.some((a) => a.includes("Masters"))).toBe(true);
    expect(report.anomalies.some((a) => a.includes("Champions"))).toBe(true);
  });

  it("flags a failed match-discovery event as an anomaly", () => {
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [eventEntry({})] };
    const matchManifest: MatchDiscoveryManifest = { generatedAt: "t", entries: [], duplicateMatchLinks: 0, eventsWithFailedDiscovery: ["1"] };
    const report = buildPreBackfillReport(eventManifest, matchManifest, CONFIG);
    expect(report.anomalies.some((a) => a.includes("failed outright"))).toBe(true);
  });

  it("computes completed vs non-completed match counts and expected detail requests", () => {
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [eventEntry({})] };
    const matchManifest: MatchDiscoveryManifest = {
      generatedAt: "t",
      entries: [matchEntry({ vlrMatchId: "1", listedStatus: "completed" }), matchEntry({ vlrMatchId: "2", listedStatus: "upcoming" })],
      duplicateMatchLinks: 0,
      eventsWithFailedDiscovery: [],
    };
    const report = buildPreBackfillReport(eventManifest, matchManifest, CONFIG);
    expect(report.completedMatches).toBe(1);
    expect(report.nonCompletedMatches).toBe(1);
    expect(report.expectedDetailRequests).toBe(1);
    expect(report.estimatedMinimumRuntimeMs).toBe(CONFIG.minRequestIntervalMs);
  });

  it("reports no anomalies for a healthy, fully-covered dataset", () => {
    const families = ["vct-americas", "vct-emea", "vct-pacific", "vct-china", "masters", "champions"] as const;
    const eventManifest: EventDiscoveryManifest = {
      scopeStartDate: "2025-01-01",
      scopeEndDate: "2026-07-18",
      generatedAt: "t",
      entries: families.map((family, i) => eventEntry({ vlrEventId: String(i), classification: family })),
    };
    const matchManifest: MatchDiscoveryManifest = { generatedAt: "t", entries: [matchEntry({})], duplicateMatchLinks: 0, eventsWithFailedDiscovery: [] };
    const report = buildPreBackfillReport(eventManifest, matchManifest, CONFIG);
    expect(report.anomalies).toEqual([]);
  });
});
