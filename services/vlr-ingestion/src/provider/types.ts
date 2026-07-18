import type { BackfillScope } from "../scope/backfillScope";
import type { EventClassificationResult } from "../classification/eventFamily";

/**
 * Provider-agnostic ingestion interface — see
 * docs/29-vlr-data-ingestion-foundation.md ("Provider Architecture") and
 * TASK-041 requirement 5. Nothing in this file may reference VLR-specific
 * HTML details, selectors, or URL shapes; VLR is one implementation of
 * `EsportsDataProvider`, not the contract itself.
 */

export type MatchStatus = "completed" | "scheduled" | "live";

export interface ProviderFetchOptions {
  readonly signal?: AbortSignal;
}

/** Cursor-based pagination boundary for any provider list endpoint. */
export interface ProviderPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

/** Opaque incremental-sync boundary a provider hands back and later accepts to resume. */
export interface ProviderSyncCursor {
  readonly value: string;
  readonly asOf: string; // ISO 8601 timestamp
}

export interface ProviderSourceReference {
  readonly provider: string;
  readonly externalId: string;
  readonly sourceUrl: string;
}

export interface ProviderTeam {
  readonly externalId: string;
  readonly name: string;
  readonly shortName?: string;
  readonly region?: string;
  readonly sourceUrl: string;
  readonly logoUrl?: string;
}

export interface ProviderPlayer {
  readonly externalId: string;
  readonly handle: string;
  readonly realName?: string;
  readonly country?: string;
  readonly sourceUrl: string;
  readonly teamExternalId?: string;
}

export interface ProviderRosterSnapshot {
  readonly teamExternalId: string;
  readonly asOf: string; // ISO 8601 timestamp, when the roster was observed
  readonly playerExternalIds: readonly string[];
}

export interface ProviderEvent {
  readonly externalId: string;
  readonly name: string;
  readonly status: "upcoming" | "ongoing" | "completed";
  readonly startDate?: string; // ISO 8601 date
  readonly endDate?: string; // ISO 8601 date
  readonly region?: string;
  readonly season?: string;
  readonly stage?: string;
  readonly parentSeries?: string;
  readonly tags?: readonly string[];
  readonly sourceUrl: string;
  readonly classification?: EventClassificationResult;
}

export interface ProviderMatchSummary {
  readonly externalId: string;
  readonly eventExternalId: string;
  readonly teamAExternalId: string;
  readonly teamBExternalId: string;
  readonly scheduledAt?: string; // ISO 8601 timestamp
  readonly status: MatchStatus;
  readonly stageLabel?: string;
  readonly seriesFormat?: string;
  readonly sourceUrl: string;
}

export interface ProviderMapResult {
  readonly mapName: string;
  readonly order: number;
  readonly teamAScore: number;
  readonly teamBScore: number;
  readonly teamAAttackScore?: number;
  readonly teamADefenseScore?: number;
  readonly teamBAttackScore?: number;
  readonly teamBDefenseScore?: number;
  readonly winnerExternalId?: string;
  readonly overtime: boolean;
}

export interface ProviderMatchDetail extends ProviderMatchSummary {
  readonly winnerExternalId?: string;
  readonly maps: readonly ProviderMapResult[];
  readonly rosters?: readonly ProviderRosterSnapshot[];
  readonly patch?: string;
}

/**
 * The provider-neutral contract every esports data source implements.
 * `discoverEvents`/`discoverMatches` are the automatic-discovery entry
 * points TASK-042's backfill drives — no caller ever supplies a manual list
 * of match IDs.
 */
export interface EsportsDataProvider {
  readonly name: string;

  getTeams(cursor?: ProviderSyncCursor, options?: ProviderFetchOptions): Promise<ProviderPage<ProviderTeam>>;
  getTeam(externalId: string, options?: ProviderFetchOptions): Promise<ProviderTeam | null>;

  getEvents(cursor?: ProviderSyncCursor, options?: ProviderFetchOptions): Promise<ProviderPage<ProviderEvent>>;
  getEvent(externalId: string, options?: ProviderFetchOptions): Promise<ProviderEvent | null>;

  getMatches(eventExternalId: string, cursor?: ProviderSyncCursor, options?: ProviderFetchOptions): Promise<ProviderPage<ProviderMatchSummary>>;
  getMatch(externalId: string, options?: ProviderFetchOptions): Promise<ProviderMatchDetail | null>;

  /** Discovers events within a backfill scope's date range, bounded by scope.maximumEvents. */
  discoverEvents(scope: BackfillScope, options?: ProviderFetchOptions): Promise<ProviderPage<ProviderEvent>>;

  /** Discovers match summaries belonging to a single already-discovered event. */
  discoverMatches(eventExternalId: string, options?: ProviderFetchOptions): Promise<readonly ProviderMatchSummary[]>;

  getPlayer?(externalId: string, options?: ProviderFetchOptions): Promise<ProviderPlayer | null>;
}
