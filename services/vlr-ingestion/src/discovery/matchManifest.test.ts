import { describe, expect, it } from "vitest";
import { buildMatchDiscoveryManifest } from "./matchManifest";
import type { EventDiscoveryManifest, EventManifestEntry } from "./eventManifest";
import type { VlrIngestionProvider } from "../ingestion/vlrIngestionProvider";
import type { VlrMatchSummary } from "../vlr/schemas/raw";

function manifestEntry(overrides: Partial<EventManifestEntry>): EventManifestEntry {
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

function summary(overrides: Partial<VlrMatchSummary>): VlrMatchSummary {
  return {
    vlrMatchId: "1",
    matchUrl: "https://www.vlr.gg/1",
    status: "completed",
    vlrEventId: "1",
    source: { sourceUrl: "https://www.vlr.gg/event/matches/1", fetchedAt: "t", parserVersion: "v" },
    ...overrides,
  };
}

describe("buildMatchDiscoveryManifest", () => {
  it("only discovers matches for included events, skipping excluded/unknown ones", async () => {
    const eventManifest: EventDiscoveryManifest = {
      scopeStartDate: "2025-01-01",
      scopeEndDate: "2026-07-18",
      generatedAt: "t",
      entries: [manifestEntry({ vlrEventId: "1", inclusionStatus: "included" }), manifestEntry({ vlrEventId: "2", inclusionStatus: "excluded" })],
    };
    const provider: VlrIngestionProvider = {
      discoverEvents: async () => [],
      discoverMatches: async (id) => (id === "1" ? [summary({ vlrMatchId: "10", vlrEventId: "1" })] : (() => { throw new Error("should not be called for excluded events"); })()),
      getMatch: async () => null,
    };

    const manifest = await buildMatchDiscoveryManifest(provider, eventManifest);
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.entries[0]?.vlrMatchId).toBe("10");
  });

  it("dedupes a match ID discovered under more than one event, keeping the first event's association", async () => {
    const eventManifest: EventDiscoveryManifest = {
      scopeStartDate: "2025-01-01",
      scopeEndDate: "2026-07-18",
      generatedAt: "t",
      entries: [manifestEntry({ vlrEventId: "1" }), manifestEntry({ vlrEventId: "2" })],
    };
    const provider: VlrIngestionProvider = {
      discoverEvents: async () => [],
      discoverMatches: async (id) => [summary({ vlrMatchId: "shared", vlrEventId: id })],
      getMatch: async () => null,
    };

    const manifest = await buildMatchDiscoveryManifest(provider, eventManifest);
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.entries[0]?.eventId).toBe("1");
    expect(manifest.duplicateMatchLinks).toBe(1);
  });

  it("marks a non-completed listed match's detailFetchStatus as skipped-non-completed", async () => {
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [manifestEntry({ vlrEventId: "1" })] };
    const provider: VlrIngestionProvider = {
      discoverEvents: async () => [],
      discoverMatches: async () => [summary({ vlrMatchId: "10", status: "upcoming" })],
      getMatch: async () => null,
    };

    const manifest = await buildMatchDiscoveryManifest(provider, eventManifest);
    expect(manifest.entries[0]?.detailFetchStatus).toBe("skipped-non-completed");
  });

  it("records an event whose match discovery fails outright, without aborting the rest of the scan", async () => {
    const eventManifest: EventDiscoveryManifest = {
      scopeStartDate: "2025-01-01",
      scopeEndDate: "2026-07-18",
      generatedAt: "t",
      entries: [manifestEntry({ vlrEventId: "1" }), manifestEntry({ vlrEventId: "2" })],
    };
    const provider: VlrIngestionProvider = {
      discoverEvents: async () => [],
      discoverMatches: async (id) => {
        if (id === "1") throw new Error("network error");
        return [summary({ vlrMatchId: "20", vlrEventId: "2" })];
      },
      getMatch: async () => null,
    };

    const manifest = await buildMatchDiscoveryManifest(provider, eventManifest);
    expect(manifest.eventsWithFailedDiscovery).toEqual(["1"]);
    expect(manifest.entries).toHaveLength(1);
  });
});
