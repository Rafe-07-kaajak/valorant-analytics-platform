import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { reconcileEvents } from "./eventReconciliation";
import type { EventDiscoveryManifest, EventManifestEntry } from "../discovery/eventManifest";

let store: FilesystemIngestionStore;

beforeEach(async () => {
  store = new FilesystemIngestionStore(await mkdtemp(join(tmpdir(), "vlr-recon-test-")));
});

afterEach(async () => {
  await store._clearForTests();
});

function manifestEntry(overrides: Partial<EventManifestEntry> = {}): EventManifestEntry {
  return {
    vlrEventId: "100",
    name: "VCT 2026: Americas Stage 1",
    sourceUrl: "https://www.vlr.gg/event/100",
    tournamentLevel: "league",
    classification: "vct-americas",
    confidence: "high",
    evidence: [],
    inclusionStatus: "included",
    discoveredAt: "t",
    ...overrides,
  };
}

function manifest(entries: readonly EventManifestEntry[]): EventDiscoveryManifest {
  return { scopeStartDate: "2025-01-01", scopeEndDate: "2026-12-31", generatedAt: "t", entries };
}

describe("reconcileEvents", () => {
  it("categorizes a persisted record whose manifest entry is included as current-approved", async () => {
    await store.upsertNormalizedEntity("event", "vlr:event:100", { internalId: "vlr:event:100" });
    const report = await reconcileEvents(store, manifest([manifestEntry()]));
    expect(report.entries).toEqual([expect.objectContaining({ internalId: "vlr:event:100", category: "current-approved" })]);
  });

  it("categorizes a persisted record no longer in the current manifest as stale", async () => {
    await store.upsertNormalizedEntity("event", "vlr:event:999", { internalId: "vlr:event:999" });
    const report = await reconcileEvents(store, manifest([]));
    expect(report.entries).toEqual([expect.objectContaining({ internalId: "vlr:event:999", category: "stale" })]);
  });

  it("categorizes a persisted record whose manifest entry now excludes it as out-of-scope", async () => {
    await store.upsertNormalizedEntity("event", "vlr:event:100", { internalId: "vlr:event:100" });
    const report = await reconcileEvents(store, manifest([manifestEntry({ inclusionStatus: "excluded", exclusionReason: "outside-date-scope" })]));
    expect(report.entries).toEqual([expect.objectContaining({ internalId: "vlr:event:100", category: "out-of-scope" })]);
  });

  it("categorizes a correctly-excluded, never-persisted manifest entry as audit-only-historical", async () => {
    const report = await reconcileEvents(store, manifest([manifestEntry({ vlrEventId: "200", inclusionStatus: "excluded", exclusionReason: "excluded-tier-2" })]));
    expect(report.entries).toEqual([expect.objectContaining({ internalId: "vlr:event:200", category: "audit-only-historical" })]);
  });

  it("flags a persisted record with a malformed internal ID as orphaned", async () => {
    await store.upsertNormalizedEntity("event", "not-a-valid-source-reference", { internalId: "not-a-valid-source-reference" });
    const report = await reconcileEvents(store, manifest([]));
    expect(report.entries).toEqual([expect.objectContaining({ category: "orphaned" })]);
  });

  it("does not report an included-but-not-yet-normalized event as stale (a discovery gap, not a reconciliation concern)", async () => {
    const report = await reconcileEvents(store, manifest([manifestEntry()]));
    expect(report.entries).toHaveLength(0);
  });

  it("never deletes or mutates the underlying persisted record", async () => {
    await store.upsertNormalizedEntity("event", "vlr:event:999", { internalId: "vlr:event:999" });
    await reconcileEvents(store, manifest([]));
    expect(await store.getNormalizedEntity("event", "vlr:event:999")).toEqual({ internalId: "vlr:event:999" });
  });
});
