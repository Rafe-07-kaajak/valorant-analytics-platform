import type { BackfillScope } from "../scope/backfillScope";
import type { VlrEvent, VlrMatchDetail, VlrMatchSummary } from "../vlr/schemas/raw";

/**
 * The narrow, VLR-typed contract the ingestion coordinator actually drives
 * in TASK-041 — see docs/29-vlr-data-ingestion-foundation.md ("Provider
 * Architecture — a documented design decision"). `provider/types.ts`
 * (`EsportsDataProvider`) is the provider-*neutral* contract future
 * providers implement; VLR is the only provider wired up today, so the
 * coordinator consumes VLR's own raw schemas directly rather than through
 * an extra Provider*-shaped conversion layer that has no second consumer
 * yet. A future second provider would add that conversion at the point it
 * is actually needed (CLAUDE.md Rule 6 — prefer the simpler solution).
 */
export interface VlrFetchOptions {
  readonly signal?: AbortSignal;
}

export interface VlrIngestionProvider {
  /** Discovers full event records within the scope's date range, bounded by scope.maximumEvents. */
  discoverEvents(scope: BackfillScope, options?: VlrFetchOptions): Promise<readonly VlrEvent[]>;
  /** Discovers match summaries belonging to one already-discovered event. */
  discoverMatches(vlrEventId: string, options?: VlrFetchOptions): Promise<readonly VlrMatchSummary[]>;
  /** Fetches full match detail for one already-discovered match. */
  getMatch(vlrMatchId: string, vlrEventId: string, options?: VlrFetchOptions): Promise<VlrMatchDetail | null>;
}
