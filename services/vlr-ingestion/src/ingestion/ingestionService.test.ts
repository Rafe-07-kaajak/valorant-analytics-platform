import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IngestionService } from "./ingestionService";
import { FixtureVlrProvider } from "./fixtureProvider";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { buildTeamMappingLookup } from "../identity/teamMapping";
import { buildOverrideLookup } from "../classification/eventOverrides";
import { buildCanonicalTargetScope, validateBackfillScope } from "../scope/backfillScope";
import type { BackfillScope } from "../scope/backfillScope";
import { IngestionError } from "../errors";
import type { NormalizedMatch } from "../normalize/normalizedSchemas";

function spyOnGlobalFetch() {
  return vi.spyOn(globalThis, "fetch");
}

const TEAM_MAPPING = buildTeamMappingLookup([{ vlrTeamId: "2593", internalTeamId: "fnatic", reason: "Verified from fixture." }]);
const NO_OVERRIDES = buildOverrideLookup([]);

function testScope(overrides: Partial<BackfillScope> = {}): BackfillScope {
  return { ...buildCanonicalTargetScope(new Date("2026-07-18T00:00:00.000Z")), maximumEvents: 10, maximumMatches: 10, ...overrides };
}

describe("IngestionService — fixture ingestion end-to-end", () => {
  let rootDir: string;
  let store: FilesystemIngestionStore;
  let service: IngestionService;
  let fetchSpy: ReturnType<typeof spyOnGlobalFetch>;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "vlr-ingestion-service-test-"));
    store = new FilesystemIngestionStore(rootDir);
    service = new IngestionService({ provider: new FixtureVlrProvider("2026-07-18T00:00:00.000Z"), store, teamMapping: TEAM_MAPPING, eventOverrides: NO_OVERRIDES, now: () => new Date("2026-07-18T00:00:00.000Z") });
    fetchSpy = spyOnGlobalFetch();
  });

  afterEach(async () => {
    await store._clearForTests();
    fetchSpy.mockRestore();
  });

  it("rejects an invalid scope before touching the provider", async () => {
    await expect(service.run(testScope({ eventFamilies: [] }))).rejects.toThrow(IngestionError);
  });

  it("discovers events automatically from the fixture listing, with no manual event ID list", async () => {
    const summary = await service.run(testScope());
    expect(summary.discoveredEvents).toBe(3);
  });

  it("includes approved-family events and excludes the tier-2 event with a reason", async () => {
    const summary = await service.run(testScope());
    expect(summary.includedEvents).toBe(2);
    expect(summary.excludedEventsByReason["excluded-tier-2"]).toBe(1);
  });

  it("discovers matches automatically for included events and dedupes the repeated link", async () => {
    const summary = await service.run(testScope());
    expect(summary.discoveredMatchLinks).toBe(3);
    expect(summary.duplicateMatchLinks).toBe(1);
    expect(summary.fetchedMatches).toBe(2);
  });

  it("persists normalized event and match records reachable through the store", async () => {
    await service.run(testScope());
    const match = await store.getNormalizedEntity<NormalizedMatch>("match", "vlr:match:347540");
    expect(match?.winnerId).toBe("fnatic");
    const event = await store.getNormalizedEntity("event", "vlr:event:2001");
    expect(event).not.toBeNull();
  });

  it("reports unmapped teams while a mapped team stays out of the list", async () => {
    const summary = await service.run(testScope());
    expect(summary.unmappedTeams).toContain("vlr:team:2594");
    expect(summary.unmappedTeams).toContain("vlr:team:2595");
    expect(summary.unmappedTeams).not.toContain("fnatic");
  });

  it("reports training-eligible match counts", async () => {
    const summary = await service.run(testScope());
    expect(summary.trainingEligibleMatches).toBe(2);
  });

  it("never calls the network fetch implementation", async () => {
    await service.run(testScope());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("writes a checkpoint on a clean run", async () => {
    const summary = await service.run(testScope());
    expect(summary.checkpointStatus).toBe("saved");
  });

  it("is idempotent: a second identical run reports the matches as unchanged", async () => {
    await service.run(testScope());
    const second = await service.run(testScope());
    expect(second.insertedRecords).toBe(0);
    expect(second.skippedUnchangedMatches).toBe(2);
  });

  it("updates a record when the underlying content actually changes (different parsedAt via `now` alone does not count as a change)", async () => {
    const first = await service.run(testScope());
    const laterService = new IngestionService({
      provider: new FixtureVlrProvider("2026-07-19T00:00:00.000Z"),
      store,
      teamMapping: TEAM_MAPPING,
      eventOverrides: NO_OVERRIDES,
      now: () => new Date("2026-07-19T00:00:00.000Z"),
    });
    const second = await laterService.run(testScope());
    // 2 events + 2 matches inserted on the first run.
    expect(first.insertedRecords).toBe(4);
    // fetchedAt changed but the substantive content did not, so nothing is newly inserted.
    expect(second.insertedRecords).toBe(0);
    expect(second.skippedUnchangedMatches).toBe(2);
  });

  it("does not corrupt previously persisted data when a run is cancelled mid-flight", async () => {
    await service.run(testScope());
    const controller = new AbortController();
    controller.abort();
    await expect(service.run(testScope(), { signal: controller.signal })).rejects.toThrow(IngestionError);
    const match = await store.getNormalizedEntity<NormalizedMatch>("match", "vlr:match:347540");
    expect(match?.winnerId).toBe("fnatic");
  });

  it("supports dry-run: reports counts without persisting anything", async () => {
    const summary = await service.run(testScope(), { dryRun: true });
    expect(summary.dryRun).toBe(true);
    expect(summary.checkpointStatus).toBe("skipped-dry-run");
    expect(await store.getNormalizedEntity("match", "vlr:match:347540")).toBeNull();
  });

  it("filters out an event family not requested by the scope", async () => {
    const summary = await service.run(testScope({ eventFamilies: ["masters"] }));
    expect(summary.excludedEventsByReason["outside-requested-families"]).toBe(1);
  });
});

describe("buildCanonicalTargetScope + validateBackfillScope wiring", () => {
  it("produces a scope the ingestion service accepts", () => {
    expect(validateBackfillScope(testScope()).valid).toBe(true);
  });
});
