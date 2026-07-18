import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateCompleteness } from "./completenessValidation";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import type { EventDiscoveryCheckpoint } from "../persistence/types";
import type { EventDiscoveryManifest, EventManifestEntry } from "./eventManifest";
import type { MatchDiscoveryManifest, MatchManifestEntry } from "./matchManifest";
import type { NormalizedMatch } from "../normalize/normalizedSchemas";

const COMPLETE_CHECKPOINT: EventDiscoveryCheckpoint = { lastCompletedPage: 10, discoveredEventIds: [], updatedAt: "t", scopeHash: "h", parserVersion: "v", archiveComplete: true };

function eventEntry(overrides: Partial<EventManifestEntry>): EventManifestEntry {
  return {
    vlrEventId: "2001",
    name: "VCT 2025: Americas Stage 1",
    sourceUrl: "https://www.vlr.gg/event/2001",
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

function completeEventManifest(entries: readonly EventManifestEntry[]): EventDiscoveryManifest {
  // buildCanonicalTargetScope's six approved families, one included entry each, so
  // "zero events for an approved family" never fires unless a test wants it to.
  const families = ["vct-americas", "vct-emea", "vct-pacific", "vct-china", "masters", "champions"] as const;
  const filler = families.map((family, index) => eventEntry({ vlrEventId: `filler-${index}`, classification: family }));
  return { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [...filler, ...entries] };
}

function matchManifest(entries: readonly MatchManifestEntry[]): MatchDiscoveryManifest {
  return { generatedAt: "t", entries, duplicateMatchLinks: 0, eventsWithFailedDiscovery: [] };
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
    eventId: "vlr:event:2001",
    maps: [{ map: { name: "Ascent", raw: "Ascent", recognized: true }, order: 1, teamAScore: 13, teamBScore: 9, overtime: false, qualityFlags: [] }],
    rosterSnapshots: [
      { teamInternalId: "fnatic", asOf: "t", playerInternalIds: ["1", "2", "3", "4", "5"] },
      { teamInternalId: "vlr:team:2594", asOf: "t", playerInternalIds: ["6", "7", "8", "9", "10"] },
    ],
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
  rootDir = await mkdtemp(join(tmpdir(), "vlr-completeness-test-"));
  store = new FilesystemIngestionStore(rootDir);
});

afterEach(async () => {
  await store._clearForTests();
});

/** Marks every event in `manifest` as match-discovery verified-complete — the happy-path baseline most tests build on. */
async function seedVerifiedMatchCheckpoints(targetStore: FilesystemIngestionStore, manifest: EventDiscoveryManifest): Promise<void> {
  for (const entry of manifest.entries) {
    if (entry.inclusionStatus !== "included") continue;
    await targetStore.writeMatchDiscoveryCheckpoint(entry.vlrEventId, { discoveredMatchIds: ["1"], updatedAt: "t", expectedMatchCount: 1, verifiedComplete: true });
  }
}

describe("validateCompleteness", () => {
  it("passes for a fully accounted-for, internally consistent, fully-discovered dataset", async () => {
    await store.upsertNormalizedEntity("match", "vlr:match:1", normalizedMatch());
    const eventManifest = completeEventManifest([eventEntry({})]);
    await seedVerifiedMatchCheckpoints(store, eventManifest);
    const result = await validateCompleteness(store, eventManifest, matchManifest([matchEntry({})]), COMPLETE_CHECKPOINT);
    expect(result.valid).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("fails when event discovery has not been confirmed to reach the scope start date", async () => {
    const eventManifest = completeEventManifest([eventEntry({})]);
    await seedVerifiedMatchCheckpoints(store, eventManifest);
    await store.upsertNormalizedEntity("match", "vlr:match:1", normalizedMatch());

    const incompleteCheckpoint: EventDiscoveryCheckpoint = { ...COMPLETE_CHECKPOINT, archiveComplete: false };
    const result = await validateCompleteness(store, eventManifest, matchManifest([matchEntry({})]), incompleteCheckpoint);
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.includes("not been confirmed complete"))).toBe(true);
  });

  it("fails when no discovery checkpoint exists at all", async () => {
    const eventManifest = completeEventManifest([eventEntry({})]);
    await seedVerifiedMatchCheckpoints(store, eventManifest);
    const result = await validateCompleteness(store, eventManifest, matchManifest([matchEntry({})]), null);
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.includes("not been confirmed complete"))).toBe(true);
  });

  it("fails when an approved family has zero included events", async () => {
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [] };
    const result = await validateCompleteness(store, eventManifest, matchManifest([]), COMPLETE_CHECKPOINT);
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.includes("vct-americas"))).toBe(true);
  });

  it("fails when an included event has no match-discovery checkpoint", async () => {
    const eventManifest = completeEventManifest([eventEntry({})]);
    // Seed every event EXCEPT the one under test, leaving it without a checkpoint.
    for (const entry of eventManifest.entries) {
      if (entry.vlrEventId === "2001") continue;
      await store.writeMatchDiscoveryCheckpoint(entry.vlrEventId, { discoveredMatchIds: ["1"], updatedAt: "t", expectedMatchCount: 1, verifiedComplete: true });
    }
    await store.upsertNormalizedEntity("match", "vlr:match:1", normalizedMatch());

    const result = await validateCompleteness(store, eventManifest, matchManifest([matchEntry({})]), COMPLETE_CHECKPOINT);
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.includes("2001") && f.includes("no match-discovery checkpoint"))).toBe(true);
  });

  it("fails when an included event's match discovery is not verified complete (incomplete pagination)", async () => {
    const eventManifest = completeEventManifest([eventEntry({})]);
    await seedVerifiedMatchCheckpoints(store, eventManifest);
    // Override 2001's checkpoint with an unverified, short count.
    await store.writeMatchDiscoveryCheckpoint("2001", { discoveredMatchIds: ["1"], updatedAt: "t", expectedMatchCount: 5, verifiedComplete: false });
    await store.upsertNormalizedEntity("match", "vlr:match:1", normalizedMatch());

    const result = await validateCompleteness(store, eventManifest, matchManifest([matchEntry({})]), COMPLETE_CHECKPOINT);
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.includes("2001") && f.includes("incomplete pagination"))).toBe(true);
  });

  it("fails when a discovered completed match has no normalized record and no recorded failure", async () => {
    const eventManifest = completeEventManifest([eventEntry({})]);
    await seedVerifiedMatchCheckpoints(store, eventManifest);
    const result = await validateCompleteness(store, eventManifest, matchManifest([matchEntry({ vlrMatchId: "unaccounted" })]), COMPLETE_CHECKPOINT);
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.includes("unaccounted"))).toBe(true);
  });

  it("does not fail when a discovered completed match has a recorded (even unresolved) failure instead of a normalized record", async () => {
    const eventManifest = completeEventManifest([eventEntry({})]);
    await seedVerifiedMatchCheckpoints(store, eventManifest);
    await store.recordFailure({ entityType: "match", externalId: "1", operation: "fetch-match", errorCode: "timeout", retryable: true, safeMessage: "a" }, "t");
    const result = await validateCompleteness(store, eventManifest, matchManifest([matchEntry({})]), COMPLETE_CHECKPOINT);
    expect(result.valid).toBe(true);
  });

  it("fails when a training-eligible match has no winner", async () => {
    const eventManifest = completeEventManifest([eventEntry({})]);
    await seedVerifiedMatchCheckpoints(store, eventManifest);
    await store.upsertNormalizedEntity("match", "vlr:match:1", normalizedMatch({ winnerId: null, trainingEligibility: { eligible: true, reasons: [] } }));
    const result = await validateCompleteness(store, eventManifest, matchManifest([matchEntry({})]), COMPLETE_CHECKPOINT);
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.includes("no winner"))).toBe(true);
  });

  it("fails when a training-eligible match has zero played maps", async () => {
    const eventManifest = completeEventManifest([eventEntry({})]);
    await seedVerifiedMatchCheckpoints(store, eventManifest);
    await store.upsertNormalizedEntity(
      "match",
      "vlr:match:1",
      normalizedMatch({ maps: [{ map: { name: "Ascent", raw: "Ascent", recognized: true }, order: 1, teamAScore: null, teamBScore: null, overtime: false, qualityFlags: [] }] }),
    );
    const result = await validateCompleteness(store, eventManifest, matchManifest([matchEntry({})]), COMPLETE_CHECKPOINT);
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.includes("zero played maps"))).toBe(true);
  });

  it("fails when a training-eligible match is scheduled after the approved scope end date", async () => {
    const eventManifest = completeEventManifest([eventEntry({})]);
    await seedVerifiedMatchCheckpoints(store, eventManifest);
    await store.upsertNormalizedEntity("match", "vlr:match:1", normalizedMatch({ scheduledAt: { iso: "2027-01-01T00:00:00.000Z", raw: "r", confidence: "high" } }));
    const result = await validateCompleteness(store, eventManifest, matchManifest([matchEntry({})]), COMPLETE_CHECKPOINT);
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.includes("after the approved scope end date"))).toBe(true);
  });

  it("warns (does not fail) on an incomplete roster", async () => {
    const eventManifest = completeEventManifest([eventEntry({})]);
    await seedVerifiedMatchCheckpoints(store, eventManifest);
    await store.upsertNormalizedEntity("match", "vlr:match:1", normalizedMatch({ rosterSnapshots: undefined }));
    const result = await validateCompleteness(store, eventManifest, matchManifest([matchEntry({})]), COMPLETE_CHECKPOINT);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("incomplete roster"))).toBe(true);
  });
});
