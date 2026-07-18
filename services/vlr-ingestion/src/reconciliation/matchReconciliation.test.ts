import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { reconcileMatches } from "./matchReconciliation";
import type { MatchDiscoveryManifest, MatchManifestEntry } from "../discovery/matchManifest";

let store: FilesystemIngestionStore;

beforeEach(async () => {
  store = new FilesystemIngestionStore(await mkdtemp(join(tmpdir(), "vlr-match-recon-test-")));
});

afterEach(async () => {
  await store._clearForTests();
});

function entry(overrides: Partial<MatchManifestEntry> = {}): MatchManifestEntry {
  return {
    vlrMatchId: "500",
    eventId: "100",
    eventFamily: "vct-americas",
    matchUrl: "https://www.vlr.gg/500",
    listedStatus: "completed",
    discoverySourceUrl: "u",
    discoveryTimestamp: "t",
    detailFetchStatus: "fetched",
    ...overrides,
  };
}

function manifest(entries: readonly MatchManifestEntry[]): MatchDiscoveryManifest {
  return { generatedAt: "t", entries, duplicateMatchLinks: 0, eventsWithFailedDiscovery: [] };
}

describe("reconcileMatches", () => {
  it("categorizes a persisted, listed-completed match under a current-approved event as current-approved", async () => {
    await store.upsertNormalizedEntity("match", "vlr:match:500", { internalId: "vlr:match:500" });
    const report = await reconcileMatches(store, manifest([entry()]), new Map([["100", "current-approved"]]));
    expect(report.entries).toEqual([expect.objectContaining({ internalId: "vlr:match:500", category: "current-approved" })]);
  });

  it("categorizes a persisted match whose parent event is out-of-scope as out-of-scope, even though the match record itself hasn't changed", async () => {
    await store.upsertNormalizedEntity("match", "vlr:match:500", { internalId: "vlr:match:500" });
    const report = await reconcileMatches(store, manifest([entry()]), new Map([["100", "out-of-scope"]]));
    expect(report.entries).toEqual([expect.objectContaining({ category: "out-of-scope" })]);
  });

  it("categorizes a persisted match no longer in the current match manifest as stale", async () => {
    await store.upsertNormalizedEntity("match", "vlr:match:999", { internalId: "vlr:match:999" });
    const report = await reconcileMatches(store, manifest([]), new Map());
    expect(report.entries).toEqual([expect.objectContaining({ internalId: "vlr:match:999", category: "stale" })]);
  });

  it("categorizes a persisted match whose parent event has no reconciliation entry at all as orphaned", async () => {
    await store.upsertNormalizedEntity("match", "vlr:match:500", { internalId: "vlr:match:500" });
    const report = await reconcileMatches(store, manifest([entry()]), new Map());
    expect(report.entries).toEqual([expect.objectContaining({ category: "orphaned" })]);
  });

  it("categorizes a correctly-excluded, never-persisted non-completed match as audit-only-historical", async () => {
    const report = await reconcileMatches(store, manifest([entry({ vlrMatchId: "600", listedStatus: "postponed" })]), new Map([["100", "current-approved"]]));
    expect(report.entries).toEqual([expect.objectContaining({ internalId: "vlr:match:600", category: "audit-only-historical" })]);
  });

  it("never deletes or mutates the underlying persisted record", async () => {
    await store.upsertNormalizedEntity("match", "vlr:match:999", { internalId: "vlr:match:999" });
    await reconcileMatches(store, manifest([]), new Map());
    expect(await store.getNormalizedEntity("match", "vlr:match:999")).toEqual({ internalId: "vlr:match:999" });
  });
});
