import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { loadNormalizedDataset } from "../discovery/loadNormalizedDataset";
import { runQualityAudit } from "../quality/qualityAudit";
import { evaluateQuarantine } from "../quality/quarantine";
import type { QuarantineRecord } from "../quality/quarantine";
import { runFullReconciliation } from "../reconciliation/runReconciliation";
import { buildCategoryByExternalId } from "../reconciliation/reconciliationTypes";
import { buildCuratedDataset } from "../curate/curatedExport";
import { buildTeamAudit } from "../identity/identityAudit";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";
import type { EventDiscoveryManifest, EventManifestEntry } from "../discovery/eventManifest";
import type { MatchDiscoveryManifest, MatchManifestEntry } from "../discovery/matchManifest";
import type { NormalizedEvent, NormalizedMatch, QualityIssue } from "../index";

/**
 * End-to-end TASK-043 pipeline integration test — TASK-043 requirement 23.
 * Builds a small synthetic dataset that mirrors the shape of the real
 * TASK-042 backfill output (an included event with clean/dirty matches,
 * plus a since-excluded event whose match was never cleaned up — the exact
 * stale-artifact scenario TASK-042 documented), then drives the full
 * audit → reconciliation → quarantine → curation pipeline against it, all
 * without any network access.
 */
let store: FilesystemIngestionStore;

beforeEach(async () => {
  store = new FilesystemIngestionStore(await mkdtemp(join(tmpdir(), "vlr-task043-pipeline-test-")));
});

afterEach(async () => {
  await store._clearForTests();
});

function buildEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    internalId: "vlr:event:100",
    name: "VCT 2026: Americas Stage 1",
    status: "completed",
    startDate: { iso: "2025-01-01T00:00:00.000Z", raw: "r", confidence: "high" },
    endDate: { iso: "2025-03-01T00:00:00.000Z", raw: "r", confidence: "high" },
    tournamentLevel: "league",
    eventFamily: "vct-americas",
    classification: { classification: "vct-americas", confidence: "high", reason: "r", evidence: [] },
    metadata: { provider: "vlr", providerExternalId: "100", sourceUrl: "https://www.vlr.gg/event/100", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h" },
    ...overrides,
  };
}

function eventManifestEntry(overrides: Partial<EventManifestEntry> = {}): EventManifestEntry {
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

function matchManifestEntry(overrides: Partial<MatchManifestEntry> = {}): MatchManifestEntry {
  return {
    vlrMatchId: "1",
    eventId: "100",
    eventFamily: "vct-americas",
    matchUrl: "https://www.vlr.gg/1",
    listedStatus: "completed",
    discoverySourceUrl: "u",
    discoveryTimestamp: "t",
    detailFetchStatus: "fetched",
    ...overrides,
  };
}

describe("TASK-043 full pipeline (audit -> reconciliation -> quarantine -> curation)", () => {
  it("preserves a clean current-approved match, quarantines a structurally-broken one, and excludes a stale event's match — deterministically, twice in a row", async () => {
    // Event A: currently included and approved.
    await store.upsertNormalizedEntity("event", "vlr:event:100", buildEvent());
    // Event B: persisted (an artifact of a past bug) but the *current* manifest no longer includes it at all.
    await store.upsertNormalizedEntity("event", "vlr:event:200", buildEvent({ internalId: "vlr:event:200", metadata: { ...buildEvent().metadata, providerExternalId: "200" } }));

    const cleanMatch = buildNormalizedMatch({ internalId: "vlr:match:1", eventId: "vlr:event:100", sourceReference: { provider: "vlr", externalId: "1", sourceUrl: "https://www.vlr.gg/1" } });
    const brokenMatch = buildNormalizedMatch({
      internalId: "vlr:match:2",
      eventId: "vlr:event:100",
      winnerId: "not-a-real-team",
      sourceReference: { provider: "vlr", externalId: "2", sourceUrl: "https://www.vlr.gg/2" },
    });
    const staleEventMatch = buildNormalizedMatch({
      internalId: "vlr:match:3",
      eventId: "vlr:event:200",
      teamAId: "furia",
      teamBId: "leviatan",
      sourceReference: { provider: "vlr", externalId: "3", sourceUrl: "https://www.vlr.gg/3" },
    });

    await store.upsertNormalizedEntity("match", "vlr:match:1", cleanMatch);
    await store.upsertNormalizedEntity("match", "vlr:match:2", brokenMatch);
    await store.upsertNormalizedEntity("match", "vlr:match:3", staleEventMatch);

    // The *current* manifests only know about event A (event B was dropped — e.g. by a classification fix) and matches 1/2.
    const eventManifest: EventDiscoveryManifest = { scopeStartDate: "2025-01-01", scopeEndDate: "2026-12-31", generatedAt: "t", entries: [eventManifestEntry()] };
    const matchManifest: MatchDiscoveryManifest = {
      generatedAt: "t",
      entries: [matchManifestEntry({ vlrMatchId: "1" }), matchManifestEntry({ vlrMatchId: "2" })],
      duplicateMatchLinks: 0,
      eventsWithFailedDiscovery: [],
    };

    const dataset = await loadNormalizedDataset(store);
    expect(dataset.matches).toHaveLength(3);
    expect(dataset.events).toHaveLength(2);

    // --- Reconciliation ---
    const { eventReport, matchReport } = await runFullReconciliation(store, eventManifest, matchManifest);
    expect(eventReport.entries).toContainEqual(expect.objectContaining({ internalId: "vlr:event:100", category: "current-approved" }));
    expect(eventReport.entries).toContainEqual(expect.objectContaining({ internalId: "vlr:event:200", category: "stale" }));
    expect(matchReport.entries).toContainEqual(expect.objectContaining({ internalId: "vlr:match:1", category: "current-approved" }));
    expect(matchReport.entries).toContainEqual(expect.objectContaining({ internalId: "vlr:match:2", category: "current-approved" }));
    expect(matchReport.entries).toContainEqual(expect.objectContaining({ internalId: "vlr:match:3", category: "stale" })); // matchManifest has no entry for match 3 at all — pruned along with its now-excluded parent event, per matchManifest.ts's real pruning behavior.

    // --- Quality audit ---
    const auditResult = runQualityAudit(dataset.matches, dataset.eventsById, "2025-01-01", "2026-12-31", "t");
    expect(auditResult.issues.some((i) => i.entityId === "vlr:match:2" && i.severity === "fatal")).toBe(true);

    const issuesByMatch = new Map<string, QualityIssue[]>();
    for (const issue of auditResult.issues) {
      if (issue.entityType !== "match") continue;
      const bucket = issuesByMatch.get(issue.entityId);
      if (bucket) bucket.push(issue);
      else issuesByMatch.set(issue.entityId, [issue]);
    }

    // --- Quarantine ---
    const matchCategoryByVlrId = buildCategoryByExternalId(matchReport);
    const quarantineRecords: QuarantineRecord[] = [];
    for (const match of dataset.matches as readonly NormalizedMatch[]) {
      const category = matchCategoryByVlrId.get(match.sourceReference.externalId);
      const evaluation = evaluateQuarantine({ match, reconciliationCategory: category, issues: issuesByMatch.get(match.internalId) ?? [] });
      if (evaluation.quarantined) quarantineRecords.push({ entityType: "match", internalId: match.internalId, reasons: evaluation.reasons, firstQuarantinedAt: "t", sourceReference: match.sourceReference.sourceUrl });
    }
    // Match 2 is quarantined for its own structural inconsistency; match 3 is quarantined because reconciliation categorized it "stale" — both are legitimate, independent quarantine reasons.
    expect(quarantineRecords.map((q) => q.internalId).sort()).toEqual(["vlr:match:2", "vlr:match:3"]);

    // --- Curated export ---
    const eventCategoryByInternalId = new Map(eventReport.entries.map((e) => [e.internalId, e.category]));
    const matchCategoryByInternalId = new Map(matchReport.entries.map((e) => [e.internalId, e.category]));
    const buildExport = () =>
      buildCuratedDataset({
        matches: dataset.matches,
        events: dataset.events,
        teamMapping: [],
        teamAliases: [],
        qualityIssues: auditResult.issues,
        quarantineRecords,
        matchCategoryByInternalId,
        eventCategoryByInternalId,
        sourceDatasetVersion: "test-source-v1",
        generatedAt: "2026-07-19T00:00:00.000Z",
      });

    const first = buildExport();
    // Only match 1 is current-approved AND not quarantined — match 2 is quarantined (excluded), match 3's event is stale (excluded).
    expect((first["matches.json"] as readonly NormalizedMatch[]).map((m) => m.internalId)).toEqual(["vlr:match:1"]);
    expect((first["events.json"] as readonly NormalizedEvent[]).map((e) => e.internalId)).toEqual(["vlr:event:100"]);
    expect(first["quarantine.json"]).toHaveLength(2);

    // --- Idempotency: running curation twice produces an identical curated dataset version. ---
    const second = buildExport();
    expect(second["dataset-manifest.json"].curatedDatasetVersion).toBe(first["dataset-manifest.json"].curatedDatasetVersion);

    // --- Team audit only reflects the curated (current-approved) matches. ---
    const teamAudit = buildTeamAudit(first["matches.json"] as readonly NormalizedMatch[], []);
    expect(teamAudit.entries.some((e) => e.teamInternalId === "furia")).toBe(false); // only appeared in the excluded stale-event match.
  });
});
