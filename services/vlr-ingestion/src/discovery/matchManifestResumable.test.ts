import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildMatchDiscoveryManifestResumable } from "./matchManifest";
import type { ResumableMatchDiscoveryProvider } from "./matchManifest";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import type { EventDiscoveryManifest, EventManifestEntry } from "./eventManifest";
import type { VlrMatchSummary } from "../vlr/schemas/raw";

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

let rootDir: string;
let store: FilesystemIngestionStore;

beforeEach(async () => {
  rootDir = await mkdtemp(join(tmpdir(), "vlr-match-manifest-resumable-test-"));
  store = new FilesystemIngestionStore(rootDir);
});

afterEach(async () => {
  await store._clearForTests();
});

describe("buildMatchDiscoveryManifestResumable", () => {
  it("follows a next-page cursor and merges matches across pages, deduping repeats", async () => {
    const provider: ResumableMatchDiscoveryProvider = {
      fetchMatchListPage: async (_id, pageUrl) => {
        if (!pageUrl) {
          return { summaries: [summary({ vlrMatchId: "1" }), summary({ vlrMatchId: "2" })], nextPageUrl: "https://www.vlr.gg/event/matches/1?page=2" };
        }
        // Page 2 includes a repeat of match "2" (a real-world duplicate-across-pages scenario) plus a genuinely new match.
        return { summaries: [summary({ vlrMatchId: "2" }), summary({ vlrMatchId: "3" })] };
      },
    };
    const eventManifest: EventDiscoveryManifest = {
      scopeStartDate: "2025-01-01",
      scopeEndDate: "2026-07-18",
      generatedAt: "t",
      entries: [eventEntry({ listedMatchCount: 3 })],
    };

    const result = await buildMatchDiscoveryManifestResumable(provider, eventManifest, store);

    expect(result.entries.map((e) => e.vlrMatchId).sort()).toEqual(["1", "2", "3"]);
    expect(result.duplicateMatchLinks).toBe(1);
    expect(result.countMismatchEvents).toEqual([]);
  });

  it("never re-fetches an event whose match discovery is already verified complete", async () => {
    let fetchCount = 0;
    const provider: ResumableMatchDiscoveryProvider = {
      fetchMatchListPage: async () => {
        fetchCount += 1;
        return { summaries: [summary({ vlrMatchId: "1" })] };
      },
    };
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [eventEntry({ listedMatchCount: 1 })] };

    await buildMatchDiscoveryManifestResumable(provider, eventManifest, store);
    expect(fetchCount).toBe(1);

    await buildMatchDiscoveryManifestResumable(provider, eventManifest, store);
    expect(fetchCount).toBe(1); // second call made no new requests at all
  });

  it("does not mark an event complete when discovered matches fall short of its listed count", async () => {
    const provider: ResumableMatchDiscoveryProvider = {
      fetchMatchListPage: async () => ({ summaries: [summary({ vlrMatchId: "1" })] }), // only 1 of the expected 5
    };
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [eventEntry({ listedMatchCount: 5 })] };

    const result = await buildMatchDiscoveryManifestResumable(provider, eventManifest, store);
    expect(result.countMismatchEvents).toEqual(["1"]);

    const checkpoint = await store.readMatchDiscoveryCheckpoint("1");
    expect(checkpoint?.verifiedComplete).toBe(false);
  });

  it("treats a missing listedMatchCount as unverifiable-but-not-blocking (no expected total to check against)", async () => {
    const provider: ResumableMatchDiscoveryProvider = { fetchMatchListPage: async () => ({ summaries: [summary({ vlrMatchId: "1" })] }) };
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [eventEntry({ listedMatchCount: undefined })] };

    const result = await buildMatchDiscoveryManifestResumable(provider, eventManifest, store);
    expect(result.countMismatchEvents).toEqual([]);
    expect((await store.readMatchDiscoveryCheckpoint("1"))?.verifiedComplete).toBe(true);
  });

  it("records a failed event's discovery without aborting the rest of the run", async () => {
    const provider: ResumableMatchDiscoveryProvider = {
      fetchMatchListPage: async (id) => {
        if (id === "1") throw new Error("network error");
        return { summaries: [summary({ vlrMatchId: "20", vlrEventId: "2" })] };
      },
    };
    const eventManifest: EventDiscoveryManifest = {
      scopeStartDate: "2025-01-01",
      scopeEndDate: "2026-07-18",
      generatedAt: "t",
      entries: [eventEntry({ vlrEventId: "1", listedMatchCount: 1 }), eventEntry({ vlrEventId: "2", listedMatchCount: 1 })],
    };

    const result = await buildMatchDiscoveryManifestResumable(provider, eventManifest, store);
    expect(result.eventsWithFailedDiscovery).toEqual(["1"]);
    expect(result.entries.map((e) => e.vlrMatchId)).toEqual(["20"]);
  });

  it("bounds cursor-following to a safe ceiling rather than looping forever on a misbehaving cursor", async () => {
    let requestCount = 0;
    const provider: ResumableMatchDiscoveryProvider = {
      fetchMatchListPage: async () => {
        requestCount += 1;
        return { summaries: [summary({ vlrMatchId: String(requestCount) })], nextPageUrl: "https://www.vlr.gg/event/matches/1?page=next" };
      },
    };
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [eventEntry({})] };

    await buildMatchDiscoveryManifestResumable(provider, eventManifest, store);
    expect(requestCount).toBeLessThanOrEqual(50);
  });
});
