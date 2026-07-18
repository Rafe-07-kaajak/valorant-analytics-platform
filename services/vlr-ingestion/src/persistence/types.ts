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
}

export interface EventDiscoveryCheckpoint {
  readonly lastCompletedPage: number;
  readonly discoveredEventIds: readonly string[];
  readonly updatedAt: string;
}

export interface MatchDiscoveryCheckpoint {
  readonly discoveredMatchIds: readonly string[];
  readonly updatedAt: string;
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

export type IngestionStore = RawRecordStore & NormalizedRecordStore & IngestionCheckpointStore & DiscoveryIndexStore;
