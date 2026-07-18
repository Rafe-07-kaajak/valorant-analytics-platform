import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runBackfillBatch, runRetryBatch } from "./backfillRunner";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { buildTeamMappingLookup } from "../identity/teamMapping";
import { normalizeEvent } from "../normalize/normalizeEvent";
import { classifyEvent } from "../classification/eventClassification";
import { buildCanonicalTargetScope } from "../scope/backfillScope";
import type { MatchDiscoveryManifest, MatchManifestEntry } from "../discovery/matchManifest";
import type { VlrIngestionProvider } from "./vlrIngestionProvider";
import type { VlrMatchDetail } from "../vlr/schemas/raw";
import type { NormalizedMatch } from "../normalize/normalizedSchemas";

const SCOPE = buildCanonicalTargetScope(new Date("2026-07-18T00:00:00.000Z"));
const TEAM_MAPPING = buildTeamMappingLookup([{ vlrTeamId: "2593", internalTeamId: "fnatic", reason: "test" }]);

function matchEntry(overrides: Partial<MatchManifestEntry>): MatchManifestEntry {
  return {
    vlrMatchId: "1",
    eventId: "2001",
    eventFamily: "vct-americas",
    matchUrl: "https://www.vlr.gg/1",
    listedStatus: "completed",
    discoverySourceUrl: "https://www.vlr.gg/event/matches/2001",
    discoveryTimestamp: "t",
    detailFetchStatus: "pending",
    ...overrides,
  };
}

function manifest(entries: readonly MatchManifestEntry[]): MatchDiscoveryManifest {
  return { generatedAt: "t", entries, duplicateMatchLinks: 0, eventsWithFailedDiscovery: [] };
}

function matchDetail(overrides: Partial<VlrMatchDetail>): VlrMatchDetail {
  return {
    vlrMatchId: "1",
    matchUrl: "https://www.vlr.gg/1",
    teamAVlrTeamId: "2593",
    teamBVlrTeamId: "2594",
    winnerVlrTeamId: "2593",
    seriesFormatRaw: "Bo3",
    maps: [
      { mapNameRaw: "Ascent", order: 1, teamAScore: 13, teamBScore: 9, winnerVlrTeamId: "2593", overtime: false },
      { mapNameRaw: "Bind", order: 2, teamAScore: 13, teamBScore: 7, winnerVlrTeamId: "2593", overtime: false },
    ],
    vlrEventId: "2001",
    status: "completed",
    scheduledAtIso: "2025-01-15T18:00:00.000Z",
    source: { sourceUrl: "https://www.vlr.gg/1", fetchedAt: "t", parserVersion: "v" },
    ...overrides,
  };
}

let rootDir: string;
let store: FilesystemIngestionStore;

beforeEach(async () => {
  rootDir = await mkdtemp(join(tmpdir(), "vlr-backfill-runner-test-"));
  store = new FilesystemIngestionStore(rootDir);

  const rawEvent = {
    vlrEventId: "2001",
    name: "VCT 2025: Americas Stage 1",
    status: "completed" as const,
    eventUrl: "https://www.vlr.gg/event/2001",
    parentSeries: "Champions Tour 2025",
    region: "americas",
    source: { sourceUrl: "https://www.vlr.gg/event/2001", fetchedAt: "t", parserVersion: "v" },
  };
  const classification = classifyEvent({ providerEventId: rawEvent.vlrEventId, name: rawEvent.name, parentSeries: rawEvent.parentSeries, region: rawEvent.region });
  const normalizedEvent = normalizeEvent(rawEvent, classification, "t");
  await store.upsertNormalizedEntity("event", normalizedEvent.internalId, normalizedEvent);
});

afterEach(async () => {
  await store._clearForTests();
});

describe("runBackfillBatch", () => {
  it("fetches, normalizes, and persists a pending completed match", async () => {
    let fetchCount = 0;
    const provider: VlrIngestionProvider = {
      discoverEvents: async () => [],
      discoverMatches: async () => [],
      getMatch: async () => {
        fetchCount += 1;
        return matchDetail({});
      },
    };

    const result = await runBackfillBatch({ provider, store, teamMapping: TEAM_MAPPING }, manifest([matchEntry({ vlrMatchId: "1" })]), SCOPE, 10);

    expect(result).toMatchObject({ processed: 1, inserted: 1, failed: 0 });
    expect(fetchCount).toBe(1);
    const record = await store.getNormalizedEntity<NormalizedMatch>("match", "vlr:match:1");
    expect(record?.winnerId).toBe("fnatic");
  });

  it("never re-fetches a match already normalized as completed", async () => {
    let fetchCount = 0;
    const provider: VlrIngestionProvider = {
      discoverEvents: async () => [],
      discoverMatches: async () => [],
      getMatch: async () => {
        fetchCount += 1;
        return matchDetail({});
      },
    };
    const deps = { provider, store, teamMapping: TEAM_MAPPING };
    await runBackfillBatch(deps, manifest([matchEntry({ vlrMatchId: "1" })]), SCOPE, 10);
    const second = await runBackfillBatch(deps, manifest([matchEntry({ vlrMatchId: "1" })]), SCOPE, 10);

    expect(fetchCount).toBe(1);
    expect(second.processed).toBe(0);
  });

  it("respects batch-size, leaving the rest pending for the next call", async () => {
    const provider: VlrIngestionProvider = {
      discoverEvents: async () => [],
      discoverMatches: async () => [],
      getMatch: async (id) => matchDetail({ vlrMatchId: id }),
    };
    const entries = [matchEntry({ vlrMatchId: "1" }), matchEntry({ vlrMatchId: "2" }), matchEntry({ vlrMatchId: "3" })];

    const result = await runBackfillBatch({ provider, store, teamMapping: TEAM_MAPPING }, manifest(entries), SCOPE, 2);
    expect(result.processed).toBe(2);
    expect(result.remainingPendingCount).toBe(1);
  });

  it("records a failure in the ledger and does not corrupt previously persisted records on a transient error", async () => {
    const provider: VlrIngestionProvider = {
      discoverEvents: async () => [],
      discoverMatches: async () => [],
      getMatch: async () => {
        throw new Error("network timeout");
      },
    };

    const result = await runBackfillBatch({ provider, store, teamMapping: TEAM_MAPPING }, manifest([matchEntry({ vlrMatchId: "1" })]), SCOPE, 10);
    expect(result.failed).toBe(1);
    expect(await store.getNormalizedEntity("match", "vlr:match:1")).toBeNull();
    const failures = await store.listFailures({ resolved: false });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ entityType: "match", externalId: "1", operation: "fetch-match", retryable: true, attemptCount: 1 });
  });

  it("trips the circuit breaker after 4 consecutive parse failures, preserving already-processed records and stopping early", async () => {
    const provider: VlrIngestionProvider = {
      discoverEvents: async () => [],
      discoverMatches: async () => [],
      getMatch: async (id) => (id === "1" ? matchDetail({}) : null), // every match after the first fails to parse (returns null)
    };
    const entries = ["1", "2", "3", "4", "5", "6", "7"].map((id) => matchEntry({ vlrMatchId: id }));

    const result = await runBackfillBatch({ provider, store, teamMapping: TEAM_MAPPING }, manifest(entries), SCOPE, 10);

    expect(result.circuitBreakerTripped).toBe(true);
    expect(result.inserted).toBe(1); // match "1" succeeded before the breaker tripped
    expect(await store.getNormalizedEntity("match", "vlr:match:1")).not.toBeNull();
    expect(result.processed).toBeLessThan(entries.length); // stopped before reaching every candidate
  });

  it("resets the consecutive-failure counter on a successful parse, never tripping on scattered isolated failures", async () => {
    const provider: VlrIngestionProvider = {
      discoverEvents: async () => [],
      discoverMatches: async () => [],
      getMatch: async (id) => (Number(id) % 2 === 0 ? null : matchDetail({})), // alternating success/failure
    };
    const entries = ["1", "2", "3", "4", "5", "6", "7", "8"].map((id) => matchEntry({ vlrMatchId: id }));

    const result = await runBackfillBatch({ provider, store, teamMapping: TEAM_MAPPING }, manifest(entries), SCOPE, 10);

    expect(result.circuitBreakerTripped).toBe(false);
    expect(result.processed).toBe(entries.length);
  });

  it("is idempotent: a second run over the same manifest reports nothing newly inserted", async () => {
    const provider: VlrIngestionProvider = { discoverEvents: async () => [], discoverMatches: async () => [], getMatch: async () => matchDetail({}) };
    const deps = { provider, store, teamMapping: TEAM_MAPPING };
    const first = await runBackfillBatch(deps, manifest([matchEntry({ vlrMatchId: "1" })]), SCOPE, 10);
    const second = await runBackfillBatch(deps, manifest([matchEntry({ vlrMatchId: "1" })]), SCOPE, 10);
    expect(first.inserted).toBe(1);
    expect(second.inserted).toBe(0);
    expect(second.processed).toBe(0);
  });
});

describe("runRetryBatch", () => {
  it("retries a previously failed match and succeeds, resolving the ledger entry", async () => {
    let shouldFail = true;
    const provider: VlrIngestionProvider = {
      discoverEvents: async () => [],
      discoverMatches: async () => [],
      getMatch: async () => {
        if (shouldFail) throw new Error("transient failure");
        return matchDetail({});
      },
    };
    const deps = { provider, store, teamMapping: TEAM_MAPPING };
    const entry = manifest([matchEntry({ vlrMatchId: "1" })]);

    const firstAttempt = await runBackfillBatch(deps, entry, SCOPE, 10);
    expect(firstAttempt.failed).toBe(1);

    shouldFail = false;
    const retryResult = await runRetryBatch(deps, entry, SCOPE, 10);
    expect(retryResult.inserted).toBe(1);

    const failures = await store.listFailures({ resolved: false });
    expect(failures).toHaveLength(0);
    expect(await store.getNormalizedEntity("match", "vlr:match:1")).not.toBeNull();
  });

  it("does not retry a match that was never attempted", async () => {
    let fetchCount = 0;
    const provider: VlrIngestionProvider = {
      discoverEvents: async () => [],
      discoverMatches: async () => [],
      getMatch: async () => {
        fetchCount += 1;
        return matchDetail({});
      },
    };
    const result = await runRetryBatch({ provider, store, teamMapping: TEAM_MAPPING }, manifest([matchEntry({ vlrMatchId: "1" })]), SCOPE, 10);
    expect(fetchCount).toBe(0);
    expect(result.processed).toBe(0);
  });
});
