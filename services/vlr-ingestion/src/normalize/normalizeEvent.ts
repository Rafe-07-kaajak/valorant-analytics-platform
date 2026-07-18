import type { VlrEvent } from "../vlr/schemas/raw";
import type { EventClassificationResult } from "../classification/eventFamily";
import type { TournamentLevel } from "../scope/backfillScope";
import { deterministicInternalId } from "../identity/deterministicId";
import { normalizeTimestamp } from "./dateNormalization";
import { contentHash } from "./contentHash";
import { NORMALIZED_SCHEMA_VERSION } from "./schemaVersion";
import type { IngestionRecordMetadata, NormalizedEvent } from "./normalizedSchemas";

const INTERNATIONAL_FAMILIES = new Set(["masters", "champions"]);
const LEAGUE_FAMILIES = new Set(["vct-americas", "vct-emea", "vct-pacific", "vct-china"]);

/** Derives the scope's tournament-level axis from a classification result — see requirement 3/4. */
export function deriveTournamentLevel(classification: EventClassificationResult["classification"]): TournamentLevel | "unknown" {
  if (INTERNATIONAL_FAMILIES.has(classification)) return "international";
  if (LEAGUE_FAMILIES.has(classification)) return "league";
  return "unknown";
}

/**
 * Raw → normalized event, idempotent — see
 * docs/29-vlr-data-ingestion-foundation.md ("Raw vs Normalized Data") and
 * TASK-041 requirement 7.
 */
export function normalizeEvent(raw: VlrEvent, classification: EventClassificationResult, parsedAt: string): NormalizedEvent {
  const { source, ...content } = raw;
  const metadata: IngestionRecordMetadata = {
    provider: "vlr",
    providerExternalId: raw.vlrEventId,
    sourceUrl: source.sourceUrl,
    fetchedAt: source.fetchedAt,
    parsedAt,
    schemaVersion: NORMALIZED_SCHEMA_VERSION,
    contentHash: contentHash(content),
  };

  return {
    internalId: deterministicInternalId("event", raw.vlrEventId),
    name: raw.name,
    status: raw.status,
    startDate: normalizeTimestamp(raw.startDateRaw, raw.startDateIso),
    endDate: normalizeTimestamp(raw.endDateRaw, raw.endDateIso),
    season: raw.season,
    region: raw.region,
    stage: raw.stage,
    tournamentLevel: deriveTournamentLevel(classification.classification),
    eventFamily: classification.classification,
    classification: {
      classification: classification.classification,
      confidence: classification.confidence,
      reason: classification.reason,
      evidence: classification.evidence,
    },
    metadata,
  };
}
