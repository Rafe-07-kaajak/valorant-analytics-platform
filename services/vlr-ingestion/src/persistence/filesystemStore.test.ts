import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FilesystemIngestionStore } from "./filesystemStore";
import { IngestionError } from "../errors";

let store: FilesystemIngestionStore;
let rootDir: string;

beforeEach(async () => {
  rootDir = await mkdtemp(join(tmpdir(), "vlr-ingestion-test-"));
  store = new FilesystemIngestionStore(rootDir);
});

afterEach(async () => {
  await store._clearForTests();
});

describe("FilesystemIngestionStore — raw documents", () => {
  it("round-trips a raw document", async () => {
    await store.upsertRawDocument({ provider: "vlr", entityType: "team", externalId: "2593", contentHash: "abc", sourceUrl: "https://www.vlr.gg/team/2593", fetchedAt: "t", payload: { name: "Fnatic" } });
    const result = await store.getRawDocument("vlr", "team", "2593");
    expect(result?.payload).toEqual({ name: "Fnatic" });
  });

  it("returns null for a document that was never stored", async () => {
    expect(await store.getRawDocument("vlr", "team", "missing")).toBeNull();
  });

  it("reports changed:false and skips the write when contentHash is unchanged (idempotent rerun)", async () => {
    const record = { provider: "vlr", entityType: "team", externalId: "2593", contentHash: "same-hash", sourceUrl: "u", fetchedAt: "t1", payload: { name: "Fnatic" } };
    const first = await store.upsertRawDocument(record);
    const second = await store.upsertRawDocument({ ...record, fetchedAt: "t2" });
    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect((await store.getRawDocument("vlr", "team", "2593"))?.fetchedAt).toBe("t1");
  });

  it("reports changed:true when contentHash differs", async () => {
    await store.upsertRawDocument({ provider: "vlr", entityType: "team", externalId: "1", contentHash: "h1", sourceUrl: "u", fetchedAt: "t", payload: {} });
    const second = await store.upsertRawDocument({ provider: "vlr", entityType: "team", externalId: "1", contentHash: "h2", sourceUrl: "u", fetchedAt: "t", payload: {} });
    expect(second.changed).toBe(true);
  });
});

describe("FilesystemIngestionStore — normalized entities and indexes", () => {
  it("round-trips a normalized entity", async () => {
    await store.upsertNormalizedEntity("team", "fnatic", { internalId: "fnatic", mapped: true });
    expect(await store.getNormalizedEntity("team", "fnatic")).toEqual({ internalId: "fnatic", mapped: true });
  });

  it("indexes an unmapped team automatically", async () => {
    await store.upsertNormalizedEntity("team", "vlr:team:9999", { internalId: "vlr:team:9999", mapped: false });
    expect(await store.listUnmappedTeams()).toEqual(["vlr:team:9999"]);
  });

  it("indexes an unknown-classification event automatically", async () => {
    await store.upsertNormalizedEntity("event", "vlr:event:1", { internalId: "vlr:event:1", eventFamily: "unknown" });
    expect(await store.listUnknownEvents()).toEqual(["vlr:event:1"]);
  });

  it("treats a normalized record as unchanged when only its metadata.contentHash matches, ignoring volatile fields", async () => {
    const first = await store.upsertNormalizedEntity("match", "vlr:match:1", { internalId: "vlr:match:1", metadata: { contentHash: "same-hash", parsedAt: "t1" } });
    const second = await store.upsertNormalizedEntity("match", "vlr:match:1", { internalId: "vlr:match:1", metadata: { contentHash: "same-hash", parsedAt: "t2" } });
    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect((await store.getNormalizedEntity<{ metadata: { parsedAt: string } }>("match", "vlr:match:1"))?.metadata.parsedAt).toBe("t1");
  });

  it("does not index a mapped team or a classified event", async () => {
    await store.upsertNormalizedEntity("team", "fnatic", { internalId: "fnatic", mapped: true });
    await store.upsertNormalizedEntity("event", "vlr:event:2", { internalId: "vlr:event:2", eventFamily: "masters" });
    expect(await store.listUnmappedTeams()).toEqual([]);
    expect(await store.listUnknownEvents()).toEqual([]);
  });
});

describe("FilesystemIngestionStore — checkpoints and discovery summaries", () => {
  it("round-trips an event discovery checkpoint", async () => {
    const checkpoint = { lastCompletedPage: 2, discoveredEventIds: ["1", "2"], updatedAt: "t" };
    await store.writeEventDiscoveryCheckpoint("scope-key", checkpoint);
    expect(await store.readEventDiscoveryCheckpoint("scope-key")).toEqual(checkpoint);
  });

  it("round-trips a match discovery checkpoint", async () => {
    const checkpoint = { discoveredMatchIds: ["100"], updatedAt: "t" };
    await store.writeMatchDiscoveryCheckpoint("event-1", checkpoint);
    expect(await store.readMatchDiscoveryCheckpoint("event-1")).toEqual(checkpoint);
  });

  it("round-trips a match detail checkpoint", async () => {
    const checkpoint = { contentHash: "abc", updatedAt: "t" };
    await store.writeMatchDetailCheckpoint("match-1", checkpoint);
    expect(await store.readMatchDetailCheckpoint("match-1")).toEqual(checkpoint);
  });

  it("returns null for a checkpoint that was never written", async () => {
    expect(await store.readEventDiscoveryCheckpoint("never-seen")).toBeNull();
  });

  it("round-trips a discovery summary", async () => {
    await store.recordDiscoverySummary("scope-key", { discoveredEvents: 5 });
    expect(await store.getDiscoverySummary("scope-key")).toEqual({ discoveredEvents: 5 });
  });
});

describe("FilesystemIngestionStore — failure ledger", () => {
  it("records a new failure with attemptCount 1", async () => {
    const entry = await store.recordFailure(
      { entityType: "match", externalId: "347540", operation: "fetch-match", errorCode: "timeout", retryable: true, safeMessage: "Request timed out." },
      "2026-07-18T00:00:00.000Z",
    );
    expect(entry).toMatchObject({ attemptCount: 1, resolved: false, firstFailureAt: "2026-07-18T00:00:00.000Z", latestFailureAt: "2026-07-18T00:00:00.000Z" });
  });

  it("increments attemptCount and updates latestFailureAt on a repeated failure for the same key, preserving firstFailureAt", async () => {
    await store.recordFailure({ entityType: "match", externalId: "347540", operation: "fetch-match", errorCode: "timeout", retryable: true, safeMessage: "Timed out." }, "2026-07-18T00:00:00.000Z");
    const second = await store.recordFailure({ entityType: "match", externalId: "347540", operation: "fetch-match", errorCode: "timeout", retryable: true, safeMessage: "Timed out again." }, "2026-07-18T00:05:00.000Z");
    expect(second).toMatchObject({ attemptCount: 2, firstFailureAt: "2026-07-18T00:00:00.000Z", latestFailureAt: "2026-07-18T00:05:00.000Z" });
  });

  it("keeps failures for different operations on the same entity independent", async () => {
    await store.recordFailure({ entityType: "match", externalId: "347540", operation: "discover-matches", errorCode: "timeout", retryable: true, safeMessage: "a" }, "t1");
    await store.recordFailure({ entityType: "match", externalId: "347540", operation: "fetch-match", errorCode: "timeout", retryable: true, safeMessage: "b" }, "t1");
    const failures = await store.listFailures();
    expect(failures).toHaveLength(2);
  });

  it("marks a failure resolved without deleting its history", async () => {
    await store.recordFailure({ entityType: "match", externalId: "1", operation: "fetch-match", errorCode: "timeout", retryable: true, safeMessage: "a" }, "t1");
    await store.markFailureResolved("match", "1", "fetch-match");
    const [entry] = await store.listFailures();
    expect(entry?.resolved).toBe(true);
    expect(entry?.attemptCount).toBe(1);
  });

  it("filters failures by resolved and retryable status", async () => {
    await store.recordFailure({ entityType: "match", externalId: "1", operation: "fetch-match", errorCode: "timeout", retryable: true, safeMessage: "a" }, "t1");
    await store.recordFailure({ entityType: "match", externalId: "2", operation: "fetch-match", errorCode: "invalid_provider_id", retryable: false, safeMessage: "b" }, "t1");
    await store.markFailureResolved("match", "1", "fetch-match");

    expect(await store.listFailures({ resolved: true })).toHaveLength(1);
    expect(await store.listFailures({ resolved: false })).toHaveLength(1);
    expect(await store.listFailures({ retryable: false })).toHaveLength(1);
  });

  it("returns an empty list when no failures have been recorded", async () => {
    expect(await store.listFailures()).toEqual([]);
  });
});

describe("FilesystemIngestionStore — safety and malformed input", () => {
  it("throws a persistence_failure error for a malformed JSON file instead of crashing", async () => {
    const path = join(rootDir, "raw", "vlr", "team", "broken.json");
    await mkdir(join(rootDir, "raw", "vlr", "team"), { recursive: true });
    await writeFile(path, "{ not valid json", "utf-8");
    await expect(store.getRawDocument("vlr", "team", "broken")).rejects.toThrow(IngestionError);
  });

  it("rejects a path-traversal externalId", async () => {
    await expect(store.getRawDocument("vlr", "team", "../../etc/passwd")).resolves.toBeNull();
    // safeFileName neutralizes traversal characters into underscores rather than escaping the root.
  });
});
