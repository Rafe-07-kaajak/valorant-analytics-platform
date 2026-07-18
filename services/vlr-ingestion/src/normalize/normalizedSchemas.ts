import type { BackfillScope } from "../scope/backfillScope";
import type { ClassificationConfidence, ClassificationEvidence, EventClassification } from "../classification/eventFamily";
import type { TournamentLevel } from "../scope/backfillScope";
import type { NormalizedTimestamp } from "./dateNormalization";
import type { NormalizedMapName } from "./mapNormalization";
import type { SeriesFormat } from "./seriesFormat";
import type { QualityFlag } from "./qualityFlags";
import type { VlrMatchStatus } from "../vlr/schemas/raw";
import type { TrainingEligibilityResult } from "./trainingEligibility";

/**
 * Provider-independent normalized domain schemas — see
 * docs/29-vlr-data-ingestion-foundation.md ("Raw vs Normalized Data") and
 * TASK-041 requirement 7. Everything here is provider-neutral: nothing
 * references VLR-specific field names, and the same shape would hold for
 * any future `EsportsDataProvider` implementation.
 */

export interface NormalizedSourceReference {
  readonly provider: string;
  readonly externalId: string;
  readonly sourceUrl: string;
}

export interface IngestionRecordMetadata {
  readonly provider: string;
  readonly providerExternalId: string;
  readonly sourceUrl: string;
  readonly fetchedAt: string;
  readonly parsedAt: string;
  readonly sourceUpdatedAt?: string;
  readonly schemaVersion: string;
  readonly contentHash: string;
}

export interface NormalizedEventClassification {
  readonly classification: EventClassification;
  readonly confidence: ClassificationConfidence;
  readonly reason: string;
  readonly evidence: readonly ClassificationEvidence[];
}

export interface NormalizedTeam {
  readonly internalId: string;
  readonly mapped: boolean;
  readonly name: string;
  readonly shortName?: string;
  readonly region?: string;
  readonly metadata: IngestionRecordMetadata;
}

export interface NormalizedPlayer {
  readonly internalId: string;
  readonly handle: string;
  readonly realName?: string;
  readonly country?: string;
  readonly teamInternalId?: string;
  readonly metadata: IngestionRecordMetadata;
}

export interface NormalizedRosterSnapshot {
  readonly teamInternalId: string;
  readonly asOf: string;
  readonly playerInternalIds: readonly string[];
}

export interface NormalizedEvent {
  readonly internalId: string;
  readonly name: string;
  readonly status: "upcoming" | "ongoing" | "completed";
  readonly startDate: NormalizedTimestamp;
  readonly endDate: NormalizedTimestamp;
  readonly season?: string;
  readonly region?: string;
  readonly stage?: string;
  readonly tournamentLevel: TournamentLevel | "unknown";
  readonly eventFamily: EventClassification;
  readonly classification: NormalizedEventClassification;
  readonly metadata: IngestionRecordMetadata;
}

export interface NormalizedMapResult {
  readonly map: NormalizedMapName;
  readonly order: number;
  readonly teamAScore: number | null;
  readonly teamBScore: number | null;
  readonly teamAAttackScore?: number;
  readonly teamADefenseScore?: number;
  readonly teamBAttackScore?: number;
  readonly teamBDefenseScore?: number;
  readonly winnerInternalTeamId?: string;
  readonly overtime: boolean;
  readonly qualityFlags: readonly QualityFlag[];
}

export interface NormalizedMatch {
  readonly internalId: string;
  readonly teamAId: string;
  readonly teamBId: string;
  readonly winnerId: string | null;
  readonly scheduledAt: NormalizedTimestamp;
  readonly status: VlrMatchStatus;
  readonly seriesFormat: SeriesFormat;
  readonly eventId: string;
  readonly maps: readonly NormalizedMapResult[];
  readonly rosterSnapshots?: readonly NormalizedRosterSnapshot[];
  readonly sourceReference: NormalizedSourceReference;
  readonly trainingEligibility: TrainingEligibilityResult;
  readonly qualityFlags: readonly QualityFlag[];
  readonly metadata: IngestionRecordMetadata;
}

export type NormalizedBackfillScope = BackfillScope;
