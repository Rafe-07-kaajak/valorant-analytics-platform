import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverEventsResumable } from "./eventManifest";
import type { ResumableDiscoveryProvider } from "./eventManifest";
import { buildOverrideLookup } from "../classification/eventOverrides";
import { buildCanonicalTargetScope } from "../scope/backfillScope";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import type { VlrEventDiscoveryEntry } from "../vlr/parsers/eventDiscoveryParser";
import type { VlrEvent } from "../vlr/schemas/raw";

const SCOPE = buildCanonicalTargetScope(new Date("2026-07-18T00:00:00.000Z"));
const NO_OVERRIDES = buildOverrideLookup([]);

function listingEntry(overrides: Partial<VlrEventDiscoveryEntry>): VlrEventDiscoveryEntry {
  return { vlrEventId: "1", name: "VCT 2025: Americas Stage 1", eventUrl: "https://www.vlr.gg/event/1", statusRaw: "completed", ...overrides };
}

function event(overrides: Partial<VlrEvent>): VlrEvent {
  return {
    vlrEventId: "1",
    name: "VCT 2025: Americas Stage 1",
    status: "completed",
    eventUrl: "https://www.vlr.gg/event/1",
    startDateIso: "2025-01-15T00:00:00.000Z",
    endDateIso: "2025-03-01T00:00:00.000Z",
    parentSeries: "Champions Tour 2025",
    region: "americas",
    source: { sourceUrl: "https://www.vlr.gg/event/1", fetchedAt: "t", parserVersion: "v" },
    ...overrides,
  };
}

/** A simple, in-memory, page-addressable fake — `pages[pageNumber - 1]` is that page's listing entries, `[]` (or past the end) means no more pages. */
function fakeProvider(pages: readonly (readonly VlrEventDiscoveryEntry[])[], events: ReadonlyMap<string, VlrEvent>, fetchLog: string[] = []): ResumableDiscoveryProvider {
  return {
    fetchEventListPage: async (page) => pages[page - 1] ?? [],
    fetchEventDetail: async (id: string) => {
      fetchLog.push(id);
      return events.get(id) ?? null;
    },
  };
}

let rootDir: string;
let store: FilesystemIngestionStore;

beforeEach(async () => {
  rootDir = await mkdtemp(join(tmpdir(), "vlr-discover-resumable-test-"));
  store = new FilesystemIngestionStore(rootDir);
});

afterEach(async () => {
  await store._clearForTests();
});

describe("discoverEventsResumable", () => {
  it("discovers a single page and declares the archive complete on an empty next page", async () => {
    const pages = [[listingEntry({ vlrEventId: "1" })], []];
    const events = new Map([["1", event({ vlrEventId: "1" })]]);
    const provider = fakeProvider(pages, events);

    const result = await discoverEventsResumable(provider, SCOPE, NO_OVERRIDES, store);

    expect(result.manifest.entries).toHaveLength(1);
    expect(result.archiveComplete).toBe(true);
    expect(result.checkpoint.archiveComplete).toBe(true);
  });

  it("resumes from the checkpointed page after an interrupted run, without re-fetching already-verified events", async () => {
    const fetchLog: string[] = [];
    const pages = [[listingEntry({ vlrEventId: "1" })], [listingEntry({ vlrEventId: "2" })], []];
    const events = new Map([
      ["1", event({ vlrEventId: "1" })],
      ["2", event({ vlrEventId: "2", endDateIso: "2025-02-01T00:00:00.000Z" })],
    ]);
    const provider = fakeProvider(pages, events, fetchLog);

    // First run: only scans page 1 (bounded to 1 page this invocation).
    const first = await discoverEventsResumable(provider, SCOPE, NO_OVERRIDES, store, { maxPagesThisRun: 1 });
    expect(first.archiveComplete).toBe(false);
    expect(first.checkpoint.lastCompletedPage).toBe(1);
    expect(fetchLog).toEqual(["1"]);

    // Second run: resumes from page 2, never re-fetches event 1's detail page.
    const second = await discoverEventsResumable(provider, SCOPE, NO_OVERRIDES, store);
    expect(fetchLog).toEqual(["1", "2"]);
    expect(second.manifest.entries.map((e) => e.vlrEventId).sort()).toEqual(["1", "2"]);
    expect(second.archiveComplete).toBe(true);
    expect(second.startedFresh).toBe(false);
  });

  it("declares the archive complete after several consecutive pages entirely before the scope start date", async () => {
    const fetchLog: string[] = [];
    const oldEvent = event({ vlrEventId: "old", endDateIso: "2024-06-01T00:00:00.000Z", startDateIso: "2024-05-01T00:00:00.000Z" });
    const pages = Array.from({ length: 6 }, (_, i) => [listingEntry({ vlrEventId: `old-${i}` })]);
    const events = new Map(pages.flat().map((entry) => [entry.vlrEventId, { ...oldEvent, vlrEventId: entry.vlrEventId }]));
    const provider = fakeProvider(pages, events, fetchLog);

    const result = await discoverEventsResumable(provider, SCOPE, NO_OVERRIDES, store);
    // 5 consecutive past-boundary pages required; the 6th page is never reached.
    expect(result.checkpoint.lastCompletedPage).toBe(5);
    expect(result.archiveComplete).toBe(true);
    expect(fetchLog).toHaveLength(5);
  });

  it("treats a scope/parser mismatch as a fresh start rather than silently resuming", async () => {
    const provider1 = fakeProvider([[listingEntry({ vlrEventId: "1" })], []], new Map([["1", event({ vlrEventId: "1" })]]));
    await discoverEventsResumable(provider1, SCOPE, NO_OVERRIDES, store);

    const differentScope = { ...SCOPE, startDate: "2024-01-01" };
    const provider2 = fakeProvider([[listingEntry({ vlrEventId: "2" })], []], new Map([["2", event({ vlrEventId: "2" })]]));
    const result = await discoverEventsResumable(provider2, differentScope, NO_OVERRIDES, store);

    expect(result.scopeOrParserMismatch).toBe(true);
    expect(result.startedFresh).toBe(true);
    // Fresh start re-scans from page 1 under the new scope, not a blind merge with the old campaign's entries.
    expect(result.manifest.entries.map((e) => e.vlrEventId)).toEqual(["2"]);
  });

  it("--restart-discovery ignores a perfectly valid, matching checkpoint and starts over", async () => {
    const fetchLog: string[] = [];
    const pages = [[listingEntry({ vlrEventId: "1" })], []];
    const events = new Map([["1", event({ vlrEventId: "1" })]]);
    const provider = fakeProvider(pages, events, fetchLog);

    await discoverEventsResumable(provider, SCOPE, NO_OVERRIDES, store);
    expect(fetchLog).toEqual(["1"]);

    const restarted = await discoverEventsResumable(provider, SCOPE, NO_OVERRIDES, store, { restart: true });
    expect(restarted.startedFresh).toBe(true);
    expect(fetchLog).toEqual(["1", "1"]); // re-fetched despite already being verified, because restart was explicit
  });

  it("does nothing on a subsequent call once the archive is already marked complete for the same campaign", async () => {
    const fetchLog: string[] = [];
    const provider = fakeProvider([[listingEntry({ vlrEventId: "1" })], []], new Map([["1", event({ vlrEventId: "1" })]]), fetchLog);

    await discoverEventsResumable(provider, SCOPE, NO_OVERRIDES, store);
    expect(fetchLog).toEqual(["1"]);

    const second = await discoverEventsResumable(provider, SCOPE, NO_OVERRIDES, store);
    expect(second.pagesScannedThisRun).toBe(0);
    expect(fetchLog).toEqual(["1"]); // no new requests at all
  });

  it("persists a normalized event record only for included entries, incrementally across resumed runs", async () => {
    const included = event({ vlrEventId: "1" });
    const unrelated = event({ vlrEventId: "2", name: "Local LAN Weekly", parentSeries: undefined, region: undefined });
    const provider = fakeProvider([[listingEntry({ vlrEventId: "1" }), listingEntry({ vlrEventId: "2" })], []], new Map([["1", included], ["2", unrelated]]));

    await discoverEventsResumable(provider, SCOPE, NO_OVERRIDES, store);

    expect(await store.getNormalizedEntity("event", "vlr:event:1")).not.toBeNull();
    expect(await store.getNormalizedEntity("event", "vlr:event:2")).toBeNull();
  });

  it("records a per-event failure in the ledger and continues rather than aborting the whole page", async () => {
    const provider: ResumableDiscoveryProvider = {
      fetchEventListPage: async (page) => (page === 1 ? [listingEntry({ vlrEventId: "1" }), listingEntry({ vlrEventId: "2" })] : []),
      fetchEventDetail: async (id) => {
        if (id === "1") throw new Error("network error");
        return event({ vlrEventId: "2" });
      },
    };

    const result = await discoverEventsResumable(provider, SCOPE, NO_OVERRIDES, store);
    expect(result.manifest.entries.map((e) => e.vlrEventId)).toEqual(["2"]);
    const failures = await store.listFailures();
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ entityType: "event", externalId: "1", operation: "discover-event-detail" });
  });
});
