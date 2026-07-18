import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildEventDiscoveryManifest, loadEventDiscoveryManifest, saveEventDiscoveryManifest } from "./eventManifest";
import { buildOverrideLookup } from "../classification/eventOverrides";
import { buildCanonicalTargetScope } from "../scope/backfillScope";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import type { VlrIngestionProvider } from "../ingestion/vlrIngestionProvider";
import type { VlrEvent } from "../vlr/schemas/raw";

function event(overrides: Partial<VlrEvent>): VlrEvent {
  return {
    vlrEventId: "1",
    name: "Untitled",
    status: "completed",
    eventUrl: "https://www.vlr.gg/event/1",
    // Within buildCanonicalTargetScope's 2025-01-01-to-"now" window by
    // default, so inclusion tests exercise classification without
    // incidentally tripping the (separate, deliberately-tested-elsewhere)
    // date-range gate in `buildEntry`.
    startDateIso: "2025-02-01T00:00:00.000Z",
    endDateIso: "2025-02-15T00:00:00.000Z",
    source: { sourceUrl: "https://www.vlr.gg/event/1", fetchedAt: "t", parserVersion: "v" },
    ...overrides,
  };
}

function fakeProvider(events: readonly VlrEvent[]): VlrIngestionProvider {
  return {
    discoverEvents: async () => events,
    discoverMatches: async () => [],
    getMatch: async () => null,
  };
}

let rootDir: string;
let store: FilesystemIngestionStore;

beforeEach(async () => {
  rootDir = await mkdtemp(join(tmpdir(), "vlr-event-manifest-test-"));
  store = new FilesystemIngestionStore(rootDir);
});

afterEach(async () => {
  await store._clearForTests();
});

describe("buildEventDiscoveryManifest", () => {
  it("classifies every discovered event and marks inclusion status", async () => {
    const events = [
      event({ vlrEventId: "1", name: "VCT 2025: Americas Stage 1", parentSeries: "Champions Tour 2025", region: "americas" }),
      event({ vlrEventId: "2", name: "Challengers Regional Series", parentSeries: "Champions Tour 2025", region: "americas" }),
      event({ vlrEventId: "3", name: "Local LAN Weekly" }),
    ];
    const scope = buildCanonicalTargetScope(new Date("2026-07-18T00:00:00.000Z"));
    const manifest = await buildEventDiscoveryManifest(fakeProvider(events), scope, buildOverrideLookup([]), store);

    expect(manifest.entries).toHaveLength(3);
    expect(manifest.entries[0]).toMatchObject({ vlrEventId: "1", inclusionStatus: "included", classification: "vct-americas" });
    expect(manifest.entries[1]).toMatchObject({ vlrEventId: "2", inclusionStatus: "excluded", exclusionReason: "excluded-tier-2" });
    expect(manifest.entries[2]).toMatchObject({ vlrEventId: "3", inclusionStatus: "unknown" });
  });

  it("excludes an approved-family event whose own date range never overlaps the scope — a real bug caught during TASK-042 live discovery", async () => {
    const outOfRangeEvent = event({
      vlrEventId: "1",
      name: "Champions Tour 2024: EMEA Stage 1",
      parentSeries: "Champions Tour 2024",
      region: "emea",
      startDateIso: "2024-04-04T00:00:00.000Z",
      endDateIso: "2024-05-13T00:00:00.000Z",
    });
    const scope = buildCanonicalTargetScope(new Date("2026-07-18T00:00:00.000Z")); // scope starts 2025-01-01
    const manifest = await buildEventDiscoveryManifest(fakeProvider([outOfRangeEvent]), scope, buildOverrideLookup([]), store);

    expect(manifest.entries[0]).toMatchObject({ vlrEventId: "1", classification: "vct-emea", inclusionStatus: "excluded", exclusionReason: "outside-date-scope" });
    expect(await store.getNormalizedEntity("event", "vlr:event:1")).toBeNull();
  });

  it("persists a normalized event record only for included entries", async () => {
    const events = [
      event({ vlrEventId: "1", name: "VCT 2025: Americas Stage 1", parentSeries: "Champions Tour 2025", region: "americas" }),
      event({ vlrEventId: "2", name: "Local LAN Weekly" }),
    ];
    const scope = buildCanonicalTargetScope(new Date("2026-07-18T00:00:00.000Z"));
    await buildEventDiscoveryManifest(fakeProvider(events), scope, buildOverrideLookup([]), store);

    expect(await store.getNormalizedEntity("event", "vlr:event:1")).not.toBeNull();
    expect(await store.getNormalizedEntity("event", "vlr:event:2")).toBeNull();
  });

  it("round-trips through save/load", async () => {
    const scope = buildCanonicalTargetScope(new Date("2026-07-18T00:00:00.000Z"));
    const manifest = await buildEventDiscoveryManifest(fakeProvider([event({ vlrEventId: "1" })]), scope, buildOverrideLookup([]), store);
    await saveEventDiscoveryManifest(store, manifest);
    const loaded = await loadEventDiscoveryManifest(store);
    expect(loaded).toEqual(manifest);
  });

  it("returns null when no manifest has been saved yet", async () => {
    expect(await loadEventDiscoveryManifest(store)).toBeNull();
  });
});
