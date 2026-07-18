/**
 * Persistence abstraction — see docs/29-vlr-data-ingestion-foundation.md
 * ("Persistence Policy") and TASK-041 requirement 19. Nothing in the
 * ingestion coordinator depends on the filesystem directly; it depends on
 * these interfaces, so a real database can replace `FilesystemIngestionStore`
 * later without touching coordinator logic.
 */

export interface UpsertResult {
  readonly changed: boolean;
}

export interface RawDocumentRecord<T = unknown> {
  readonly provider: string;
  readonly entityType: string;
  readonly externalId: string;
  readonly contentHash: string;
  readonly sourceUrl: string;
  readonly fetchedAt: string;
  readonly payload: T;
}

export interface RawRecordStore {
  upsertRawDocument<T>(record: RawDocumentRecord<T>): Promise<UpsertResult>;
  getRawDocument<T>(provider: string, entityType: string, externalId: string): Promise<RawDocumentRecord<T> | null>;
}

export interface NormalizedRecordStore {
  upsertNormalizedEntity<T>(entityType: string, internalId: string, record: T): Promise<UpsertResult>;
  getNormalizedEntity<T>(entityType: string, internalId: string): Promise<T | null>;
  listUnmappedTeams(): Promise<readonly string[]>;
  listUnknownEvents(): Promise<readonly string[]>;
  /** Enumerates every persisted internal ID for `entityType` — TASK-043 requirement 10 (stale-record reconciliation needs the full current-on-disk set, not just manifest-referenced IDs). Sorted, deterministic. */
  listNormalizedEntityIds(entityType: string): Promise<readonly string[]>;
  /**
   * Deletes one persisted normalized record. Destructive — TASK-043
   * requirement 10 requires this capability exist only behind an explicit,
   * separate cleanup command (`cli/cleanup.ts`) that defaults to a dry run;
   * nothing in the audit/reconciliation/curation pipeline calls this.
   */
  deleteNormalizedEntity(entityType: string, internalId: string): Promise<void>;
}

export interface EventDiscoveryCheckpoint {
  readonly lastCompletedPage: number;
  readonly discoveredEventIds: readonly string[];
  readonly updatedAt: string;
  /**
   * TASK-042 requirements: binds this checkpoint to the discovery campaign
   * that produced it. `scopeHash` covers only the *stable* identity of the
   * scan (start date + families/regions/levels) — never `endDate`, which is
   * "today" and would otherwise invalidate the checkpoint daily, defeating
   * resumability across a multi-day archive scan. `parserVersion` binds to
   * the exact parser build that classified each entry, so a parser change
   * is detected rather than silently resumed against stale evidence.
   */
  readonly scopeHash?: string;
  readonly parserVersion?: string;
  /** Set once discovery has scanned back past the scope's start date with no further in-range candidates — see `discovery/eventManifest.ts`'s `discoverEventsResumable`. */
  readonly archiveComplete?: boolean;
}

export interface MatchDiscoveryCheckpoint {
  readonly discoveredMatchIds: readonly string[];
  readonly updatedAt: string;
  /** The event page's own "Matches (N)" count at discovery time, for completeness verification — see TASK-042 requirement 2. */
  readonly expectedMatchCount?: number;
  /** True once `discoveredMatchIds.length` has been confirmed to match `expectedMatchCount` (or no count was available to check against). */
  readonly verifiedComplete?: boolean;
}

export interface MatchDetailCheckpoint {
  readonly contentHash: string;
  readonly updatedAt: string;
}

export interface IngestionCheckpointStore {
  readEventDiscoveryCheckpoint(scopeKey: string): Promise<EventDiscoveryCheckpoint | null>;
  writeEventDiscoveryCheckpoint(scopeKey: string, checkpoint: EventDiscoveryCheckpoint): Promise<void>;
  readMatchDiscoveryCheckpoint(eventExternalId: string): Promise<MatchDiscoveryCheckpoint | null>;
  writeMatchDiscoveryCheckpoint(eventExternalId: string, checkpoint: MatchDiscoveryCheckpoint): Promise<void>;
  readMatchDetailCheckpoint(matchExternalId: string): Promise<MatchDetailCheckpoint | null>;
  writeMatchDetailCheckpoint(matchExternalId: string, checkpoint: MatchDetailCheckpoint): Promise<void>;
}

export interface DiscoveryIndexStore {
  recordDiscoverySummary<T>(scopeKey: string, summary: T): Promise<void>;
  getDiscoverySummary<T>(scopeKey: string): Promise<T | null>;
}

/**
 * Persistent failure ledger — TASK-042 requirement 16. Keyed by
 * `(entityType, externalId, operation)` so the same entity can independently
 * fail at different pipeline stages (e.g. "discover-matches" vs
 * "fetch-match") without one overwriting the other. History (attempt count,
 * first/latest failure time) is preserved across retries rather than
 * replaced, so the ledger remains an audit trail, not just a current-status
 * flag.
 */
export interface FailureLedgerEntry {
  readonly entityType: "event" | "match" | "team" | "player";
  readonly externalId: string;
  readonly sourceUrl?: string;
  readonly operation: string;
  readonly errorCode: string;
  readonly retryable: boolean;
  readonly attemptCount: number;
  readonly firstFailureAt: string;
  readonly latestFailureAt: string;
  readonly safeMessage: string;
  readonly nextRetryEligibleAt?: string;
  readonly resolved: boolean;
}

export interface FailureLedgerStore {
  /** Records a new failure or increments the attempt count of an existing unresolved one for the same key. */
  recordFailure(entry: Omit<FailureLedgerEntry, "attemptCount" | "firstFailureAt" | "latestFailureAt" | "resolved">, now: string): Promise<FailureLedgerEntry>;
  markFailureResolved(entityType: FailureLedgerEntry["entityType"], externalId: string, operation: string): Promise<void>;
  listFailures(filter?: { resolved?: boolean; retryable?: boolean }): Promise<readonly FailureLedgerEntry[]>;
}

export type IngestionStore = RawRecordStore & NormalizedRecordStore & IngestionCheckpointStore & DiscoveryIndexStore & FailureLedgerStore;
