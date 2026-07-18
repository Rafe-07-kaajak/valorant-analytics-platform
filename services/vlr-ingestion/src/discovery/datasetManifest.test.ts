import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildDatasetManifest, loadDatasetManifest, saveDatasetManifest } from "./datasetManifest";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { loadVlrIngestionConfig } from "../env";
import { buildCanonicalTargetScope } from "../scope/backfillScope";
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
const config = loadVlrIngestionConfig();
const scope = buildCanonicalTargetScope(new Date("2026-07-18T00:00:00.000Z"));

beforeEach(async () => {
  rootDir = await mkdtemp(join(tmpdir(), "vlr-dataset-manifest-test-"));
  store = new FilesystemIngestionStore(rootDir);
});

afterEach(async () => {
  await store._clearForTests();
});

describe("buildDatasetManifest", () => {
  it("counts normalized and training-eligible matches from the store", async () => {
    await store.upsertNormalizedEntity("match", "vlr:match:1", normalizedMatch());
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [eventEntry({})] };
    const matchManifest: MatchDiscoveryManifest = { generatedAt: "t", entries: [matchEntry({})], duplicateMatchLinks: 0, eventsWithFailedDiscovery: [] };

    const manifest = await buildDatasetManifest(store, scope, config, eventManifest, matchManifest);
    expect(manifest.normalizedMatches).toBe(1);
    expect(manifest.trainingEligibleMatches).toBe(1);
    expect(manifest.schemaVersion).toBeTruthy();
    expect(manifest.parserVersion).toBeTruthy();
  });

  it("produces a deterministic datasetVersion for the same scope and content", async () => {
    await store.upsertNormalizedEntity("match", "vlr:match:1", normalizedMatch());
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [eventEntry({})] };
    const matchManifest: MatchDiscoveryManifest = { generatedAt: "t", entries: [matchEntry({})], duplicateMatchLinks: 0, eventsWithFailedDiscovery: [] };

    const first = await buildDatasetManifest(store, scope, config, eventManifest, matchManifest);
    const second = await buildDatasetManifest(store, scope, config, eventManifest, matchManifest);
    expect(first.datasetVersion).toBe(second.datasetVersion);
  });

  it("changes the datasetVersion when the set of normalized matches changes", async () => {
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [eventEntry({})] };
    const matchManifest: MatchDiscoveryManifest = {
      generatedAt: "t",
      entries: [matchEntry({ vlrMatchId: "1" }), matchEntry({ vlrMatchId: "2" })],
      duplicateMatchLinks: 0,
      eventsWithFailedDiscovery: [],
    };

    await store.upsertNormalizedEntity("match", "vlr:match:1", normalizedMatch());
    const before = await buildDatasetManifest(store, scope, config, eventManifest, matchManifest);

    await store.upsertNormalizedEntity("match", "vlr:match:2", normalizedMatch({ internalId: "vlr:match:2", sourceReference: { provider: "vlr", externalId: "2", sourceUrl: "https://www.vlr.gg/2" } }));
    const after = await buildDatasetManifest(store, scope, config, eventManifest, matchManifest);

    expect(after.datasetVersion).not.toBe(before.datasetVersion);
  });

  it("never uses a random UUID as the dataset version", async () => {
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [] };
    const matchManifest: MatchDiscoveryManifest = { generatedAt: "t", entries: [], duplicateMatchLinks: 0, eventsWithFailedDiscovery: [] };
    const manifest = await buildDatasetManifest(store, scope, config, eventManifest, matchManifest);
    // A UUID has dashes at fixed positions; this is a plain hex hash slice.
    expect(manifest.datasetVersion).toMatch(/^[0-9a-f]{16}$/);
  });

  it("round-trips through save/load", async () => {
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-07-18", generatedAt: "t", entries: [] };
    const matchManifest: MatchDiscoveryManifest = { generatedAt: "t", entries: [], duplicateMatchLinks: 0, eventsWithFailedDiscovery: [] };
    const manifest = await buildDatasetManifest(store, scope, config, eventManifest, matchManifest);
    await saveDatasetManifest(store, manifest);
    expect(await loadDatasetManifest(store)).toEqual(manifest);
  });
});
