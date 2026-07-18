import { createHash } from "node:crypto";
import { deterministicInternalId } from "../identity/deterministicId";
import { NORMALIZED_SCHEMA_VERSION } from "../normalize/schemaVersion";
import { PARSER_VERSION } from "../vlr/parsers/htmlUtils";
import type { VlrIngestionConfig } from "../env";
import type { BackfillScope } from "../scope/backfillScope";
import type { IngestionStore } from "../persistence/types";
import { EVENT_DISCOVERY_CHECKPOINT_KEY } from "./eventManifest";
import type { EventDiscoveryManifest } from "./eventManifest";
import type { MatchDiscoveryManifest } from "./matchManifest";
import type { NormalizedMatch } from "../normalize/normalizedSchemas";

/**
 * Dataset version manifest — TASK-042 requirement 21. Dataset identity is
 * deterministic (a hash of scope + schema/parser versions + the sorted list
 * of included external match IDs), never a random UUID, so re-running the
 * exact same backfill against the exact same discovered content always
 * produces the same dataset version.
 */
export interface DatasetManifest {
  readonly datasetVersion: string;
  readonly schemaVersion: string;
  readonly parserVersion: string;
  readonly provider: "vlr";
  readonly generatedAt: string;
  readonly scopeStartDate: string;
  readonly scopeEndDate: string;
  readonly includedEventFamilies: readonly string[];
  readonly requestPolicy: {
    readonly minRequestIntervalMs: number;
    readonly maxConcurrency: number;
    readonly maxRetries: number;
    readonly requestTimeoutMs: number;
  };
  readonly discoveredEvents: number;
  readonly includedEvents: number;
  readonly discoveredMatchLinks: number;
  readonly normalizedMatches: number;
  readonly trainingEligibleMatches: number;
  readonly unresolvedFailureCount: number;
  readonly unmappedTeamCount: number;
  readonly localStoragePath: string;
  readonly sourceAttribution: string;
  /** True only once event discovery has scanned back through `scopeStartDate` with no further in-range candidates — see `discovery/eventManifest.ts`'s `discoverEventsResumable`. A dataset manifest built while this is false is a snapshot of a still-incomplete archive scan, not the final dataset. */
  readonly archiveDiscoveryComplete: boolean;
  readonly lastCompletedDiscoveryPage: number | null;
  /** Count of included events whose match discovery is verified against the event's own listed match count — see requirement 2. */
  readonly eventsWithVerifiedMatchDiscovery: number;
}

const DATASET_MANIFEST_KEY = "dataset-manifest";

function datasetVersionHash(scope: BackfillScope, matchIds: readonly string[]): string {
  const canonical = JSON.stringify({
    scopeStartDate: scope.startDate,
    scopeEndDate: scope.endDate,
    eventFamilies: [...scope.eventFamilies].sort(),
    schemaVersion: NORMALIZED_SCHEMA_VERSION,
    parserVersion: PARSER_VERSION,
    matchIds: [...matchIds].sort(),
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

export async function buildDatasetManifest(
  store: IngestionStore,
  scope: BackfillScope,
  config: VlrIngestionConfig,
  eventManifest: EventDiscoveryManifest,
  matchManifest: MatchDiscoveryManifest,
  options?: { now?: () => Date },
): Promise<DatasetManifest> {
  const now = options?.now ?? (() => new Date());
  const includedEvents = eventManifest.entries.filter((e) => e.inclusionStatus === "included").length;

  let normalizedMatches = 0;
  let trainingEligibleMatches = 0;
  const normalizedMatchIds: string[] = [];
  // `listUnmappedTeams()` only reflects persisted "team" entities, which the
  // backfill pipeline never writes (only events and matches) — derive
  // unmapped teams directly from each normalized match's team IDs instead;
  // an unmapped team's internal ID always has the "vlr:team:<id>" form (see
  // `identity/teamMapping.ts`'s `resolveTeamIdentity`).
  const unmappedTeamIds = new Set<string>();
  for (const entry of matchManifest.entries) {
    const record = await store.getNormalizedEntity<NormalizedMatch>("match", deterministicInternalId("match", entry.vlrMatchId));
    if (!record) continue;
    normalizedMatches += 1;
    normalizedMatchIds.push(entry.vlrMatchId);
    if (record.trainingEligibility.eligible) trainingEligibleMatches += 1;
    if (record.teamAId.startsWith("vlr:team:")) unmappedTeamIds.add(record.teamAId);
    if (record.teamBId.startsWith("vlr:team:")) unmappedTeamIds.add(record.teamBId);
  }

  const unresolvedFailures = await store.listFailures({ resolved: false });

  const discoveryCheckpoint = await store.readEventDiscoveryCheckpoint(EVENT_DISCOVERY_CHECKPOINT_KEY);
  const includedEventIds = eventManifest.entries.filter((e) => e.inclusionStatus === "included").map((e) => e.vlrEventId);
  let eventsWithVerifiedMatchDiscovery = 0;
  for (const vlrEventId of includedEventIds) {
    const matchCheckpoint = await store.readMatchDiscoveryCheckpoint(vlrEventId);
    if (matchCheckpoint?.verifiedComplete) eventsWithVerifiedMatchDiscovery += 1;
  }

  return {
    datasetVersion: datasetVersionHash(scope, normalizedMatchIds),
    schemaVersion: NORMALIZED_SCHEMA_VERSION,
    parserVersion: PARSER_VERSION,
    provider: "vlr",
    generatedAt: now().toISOString(),
    scopeStartDate: scope.startDate,
    scopeEndDate: scope.endDate,
    includedEventFamilies: scope.eventFamilies,
    requestPolicy: {
      minRequestIntervalMs: config.minRequestIntervalMs,
      maxConcurrency: config.maxConcurrency,
      maxRetries: config.maxRetries,
      requestTimeoutMs: config.requestTimeoutMs,
    },
    discoveredEvents: eventManifest.entries.length,
    includedEvents,
    discoveredMatchLinks: matchManifest.entries.length,
    normalizedMatches,
    trainingEligibleMatches,
    unresolvedFailureCount: unresolvedFailures.length,
    unmappedTeamCount: unmappedTeamIds.size,
    localStoragePath: config.dataDir,
    sourceAttribution: "Data sourced from VLR.gg with permission obtained directly from VLR.gg. See docs/29-vlr-data-ingestion-foundation.md and docs/30-vlr-historical-backfill.md.",
    archiveDiscoveryComplete: discoveryCheckpoint?.archiveComplete ?? false,
    lastCompletedDiscoveryPage: discoveryCheckpoint?.lastCompletedPage ?? null,
    eventsWithVerifiedMatchDiscovery,
  };
}

export async function saveDatasetManifest(store: IngestionStore, manifest: DatasetManifest): Promise<void> {
  await store.recordDiscoverySummary(DATASET_MANIFEST_KEY, manifest);
}

export async function loadDatasetManifest(store: IngestionStore): Promise<DatasetManifest | null> {
  return store.getDiscoverySummary<DatasetManifest>(DATASET_MANIFEST_KEY);
}
