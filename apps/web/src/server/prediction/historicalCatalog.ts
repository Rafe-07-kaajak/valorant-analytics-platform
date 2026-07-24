import type { HistoricalCatalogResponse, HistoricalMatchSummary } from "@repo/shared";
import { getFeatureDatasetManifestSafe, listHistoricalRows, type RawHistoricalRow } from "./historicalFeatureRepository";
import { loadRealPredictionConfig } from "./config";
import { PredictionApiError } from "./errors";

/**
 * Server-only historical match catalog — TASK-047 requirement 6. Exposes
 * only safe selection metadata: no labels, no winner/score, no feature
 * vectors. `modelEligible` is always `true` here because every row in
 * TASK-044's export is, by construction, a fully-featured pre-match row
 * (rejected/ineligible matches never reach `feature-rows.json` at all) — see
 * docs/32, "Label policy".
 *
 * Sorted newest-first (most recently completed match leads the archive) —
 * see the real-data-correction task's Historical Archive ordering fix.
 */

export interface HistoricalCatalogFilters {
  readonly eventFamily?: string;
  readonly teamProviderId?: string;
  readonly scheduledAfter?: string;
  readonly scheduledBefore?: string;
  readonly limit?: number;
}

function isValidIsoDateString(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

/** Validates raw (string | undefined) query-parameter input into typed, bounded filters — rejects malformed input rather than silently ignoring it. */
export function validateCatalogFilters(raw: Readonly<Record<string, string | undefined>>): HistoricalCatalogFilters {
  const filters: { -readonly [K in keyof HistoricalCatalogFilters]?: HistoricalCatalogFilters[K] } = {};

  if (raw.eventFamily !== undefined) {
    if (raw.eventFamily.length === 0 || raw.eventFamily.length > 100) {
      throw new PredictionApiError("request_invalid", "eventFamily filter must be a non-empty string.");
    }
    filters.eventFamily = raw.eventFamily;
  }

  if (raw.teamProviderId !== undefined) {
    if (raw.teamProviderId.length === 0 || raw.teamProviderId.length > 256) {
      throw new PredictionApiError("request_invalid", "teamProviderId filter must be a non-empty string.");
    }
    filters.teamProviderId = raw.teamProviderId;
  }

  if (raw.scheduledAfter !== undefined) {
    if (!isValidIsoDateString(raw.scheduledAfter)) {
      throw new PredictionApiError("request_invalid", "scheduledAfter filter must be a valid ISO-8601 date string.");
    }
    filters.scheduledAfter = raw.scheduledAfter;
  }

  if (raw.scheduledBefore !== undefined) {
    if (!isValidIsoDateString(raw.scheduledBefore)) {
      throw new PredictionApiError("request_invalid", "scheduledBefore filter must be a valid ISO-8601 date string.");
    }
    filters.scheduledBefore = raw.scheduledBefore;
  }

  if (raw.limit !== undefined) {
    const parsed = Number.parseInt(raw.limit, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      throw new PredictionApiError("request_invalid", "limit filter must be a positive integer.");
    }
    filters.limit = parsed;
  }

  return filters;
}

function matchesFilters(row: RawHistoricalRow, filters: HistoricalCatalogFilters): boolean {
  if (filters.eventFamily && row.eventFamily !== filters.eventFamily) return false;
  if (filters.teamProviderId && row.teamAProviderId !== filters.teamProviderId && row.teamBProviderId !== filters.teamProviderId) return false;
  if (filters.scheduledAfter && row.scheduledAt < filters.scheduledAfter) return false;
  if (filters.scheduledBefore && row.scheduledAt > filters.scheduledBefore) return false;
  return true;
}

function toSummary(row: RawHistoricalRow, featureDatasetVersion: string): HistoricalMatchSummary {
  return {
    matchInternalId: row.matchInternalId,
    scheduledAt: row.scheduledAt,
    eventFamily: row.eventFamily,
    eventName: row.eventName,
    eventRegion: row.eventRegion,
    tournamentLevel: row.tournamentLevel,
    matchStageDisplay: row.matchStageDisplay,
    seriesFormat: row.seriesFormat,
    teamAProviderId: row.teamAProviderId,
    teamBProviderId: row.teamBProviderId,
    teamADisplayName: row.teamADisplayName,
    teamBDisplayName: row.teamBDisplayName,
    modelEligible: true,
    featureDatasetVersion,
  };
}

export async function buildHistoricalCatalog(filters: HistoricalCatalogFilters): Promise<HistoricalCatalogResponse> {
  const config = loadRealPredictionConfig();
  const manifest = await getFeatureDatasetManifestSafe();
  if (!manifest) {
    throw new PredictionApiError(
      "historical_data_unavailable",
      "The historical feature dataset is not available locally. Run the VLR feature pipeline (`pnpm ingest:vlr:features:build`) to enable historical model replay.",
    );
  }

  const rows = await listHistoricalRows();
  const filtered = rows.filter((row) => matchesFilters(row, filters));

  // Newest-first: most recently completed match leads the archive. Ties
  // break ascending on matchInternalId for determinism (mirrors TASK-044's
  // own state-engine tie-break rule, `feature/chronology.ts`) — this
  // secondary key only matters for same-timestamp matches and carries no
  // display meaning, so it is left unreversed.
  const sorted = [...filtered].sort((a, b) => {
    if (a.scheduledAt !== b.scheduledAt) return a.scheduledAt > b.scheduledAt ? -1 : 1;
    return a.matchInternalId.localeCompare(b.matchInternalId);
  });

  const boundedLimit = Math.min(filters.limit ?? config.catalogLimit, config.catalogMaxLimit);
  const page = sorted.slice(0, boundedLimit);

  return {
    matches: page.map((row) => toSummary(row, manifest.featureDatasetVersion)),
    total: sorted.length,
    featureDatasetVersion: manifest.featureDatasetVersion,
  };
}
