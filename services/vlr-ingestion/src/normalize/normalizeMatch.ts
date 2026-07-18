import type { VlrMatchDetail } from "../vlr/schemas/raw";
import type { ResolvedTeamIdentity } from "../identity/teamMapping";
import { deterministicInternalId } from "../identity/deterministicId";
import { normalizeTimestamp, isWithinDateScope } from "./dateNormalization";
import { normalizeMapName } from "./mapNormalization";
import { normalizeSeriesFormat } from "./seriesFormat";
import { countMapWins, validateMapScore } from "./scoreValidation";
import { evaluateTrainingEligibility } from "./trainingEligibility";
import { qualityFlag } from "./qualityFlags";
import type { QualityFlag } from "./qualityFlags";
import { contentHash } from "./contentHash";
import { NORMALIZED_SCHEMA_VERSION } from "./schemaVersion";
import type { IngestionRecordMetadata, NormalizedEvent, NormalizedMapResult, NormalizedMatch, NormalizedRosterSnapshot } from "./normalizedSchemas";

/** Standard Valorant competitive roster size; a smaller published roster is flagged, never fabricated up to this count. */
const EXPECTED_ROSTER_SIZE = 5;

/**
 * Raw → normalized match, idempotent — see
 * docs/29-vlr-data-ingestion-foundation.md ("Raw vs Normalized Data",
 * "Training-Eligibility Policy") and TASK-041 requirement 7/8/17/18. This is
 * the single place raw match facts, team-mapping quality, event
 * classification, and training eligibility come together into one record.
 */
export interface NormalizeMatchInput {
  readonly raw: VlrMatchDetail;
  readonly teamAIdentity: ResolvedTeamIdentity;
  readonly teamBIdentity: ResolvedTeamIdentity;
  readonly event: NormalizedEvent;
  readonly scopeStartDate: string;
  readonly scopeEndDate: string;
  readonly isDuplicate: boolean;
  readonly isShowmatch: boolean;
  readonly parsedAt: string;
}

function resolveWinnerInternalId(winnerVlrTeamId: string | undefined, raw: VlrMatchDetail, teamAIdentity: ResolvedTeamIdentity, teamBIdentity: ResolvedTeamIdentity): string | null {
  if (winnerVlrTeamId === raw.teamAVlrTeamId) return teamAIdentity.internalId;
  if (winnerVlrTeamId === raw.teamBVlrTeamId) return teamBIdentity.internalId;
  return null;
}

function normalizeMaps(raw: VlrMatchDetail, teamAIdentity: ResolvedTeamIdentity, teamBIdentity: ResolvedTeamIdentity): NormalizedMapResult[] {
  return raw.maps.map((map) => {
    const mapFlags = validateMapScore(map);
    const normalizedName = normalizeMapName(map.mapNameRaw);
    if (!normalizedName.recognized) {
      mapFlags.push(qualityFlag("unknown_map", `Map "${map.mapNameRaw}" is not in the known map pool.`, { field: "map" }));
    }
    return {
      map: normalizedName,
      order: map.order,
      teamAScore: map.teamAScore,
      teamBScore: map.teamBScore,
      teamAAttackScore: map.teamAAttackScore,
      teamADefenseScore: map.teamADefenseScore,
      teamBAttackScore: map.teamBAttackScore,
      teamBDefenseScore: map.teamBDefenseScore,
      winnerInternalTeamId: resolveWinnerInternalId(map.winnerVlrTeamId, raw, teamAIdentity, teamBIdentity) ?? undefined,
      overtime: map.overtime,
      qualityFlags: mapFlags,
    };
  });
}

function normalizeRosters(raw: VlrMatchDetail, teamAIdentity: ResolvedTeamIdentity, teamBIdentity: ResolvedTeamIdentity, asOf: string): NormalizedRosterSnapshot[] | undefined {
  if (!raw.rostersAtMatchTime) return undefined;
  return raw.rostersAtMatchTime.map((roster) => {
    const teamInternalId = roster.teamVlrTeamId === raw.teamAVlrTeamId ? teamAIdentity.internalId : roster.teamVlrTeamId === raw.teamBVlrTeamId ? teamBIdentity.internalId : deterministicInternalId("team", roster.teamVlrTeamId);
    return {
      teamInternalId,
      asOf,
      playerInternalIds: roster.vlrPlayerIds.map((vlrPlayerId) => deterministicInternalId("player", vlrPlayerId)),
    };
  });
}

export function normalizeMatch(input: NormalizeMatchInput): NormalizedMatch {
  const { raw, teamAIdentity, teamBIdentity, event } = input;
  const scheduledAt = normalizeTimestamp(raw.scheduledAtRaw, raw.scheduledAtIso);
  const seriesFormat = normalizeSeriesFormat(raw.seriesFormatRaw);
  const maps = normalizeMaps(raw, teamAIdentity, teamBIdentity);
  const rosterSnapshots = normalizeRosters(raw, teamAIdentity, teamBIdentity, input.parsedAt);
  const winnerId = resolveWinnerInternalId(raw.winnerVlrTeamId, raw, teamAIdentity, teamBIdentity);
  const { teamAWins, teamBWins } = countMapWins(raw.maps, raw.teamAVlrTeamId, raw.teamBVlrTeamId);
  const mapWinsForWinner = winnerId === teamAIdentity.internalId ? teamAWins : winnerId === teamBIdentity.internalId ? teamBWins : 0;
  const mapsPlayedCount = raw.maps.filter((map) => map.teamAScore !== null && map.teamBScore !== null).length;

  const qualityFlags: QualityFlag[] = [];
  if (!teamAIdentity.mapped) qualityFlags.push(qualityFlag("missing_team_mapping", `Team ${raw.teamAVlrTeamId} has no verified internal mapping.`, { field: "teamAId" }));
  if (!teamBIdentity.mapped) qualityFlags.push(qualityFlag("missing_team_mapping", `Team ${raw.teamBVlrTeamId} has no verified internal mapping.`, { field: "teamBId" }));
  if (!raw.seriesFormatRaw) qualityFlags.push(qualityFlag("missing_series_format", "No series format was present on the source page.", { field: "seriesFormat" }));
  if (!raw.scheduledAtRaw) qualityFlags.push(qualityFlag("missing_timestamp", "No scheduled/played timestamp was present.", { field: "scheduledAt" }));
  else if (scheduledAt.confidence === "none") qualityFlags.push(qualityFlag("ambiguous_timezone", "Scheduled timestamp could not be normalized with confidence.", { field: "scheduledAt" }));

  if (event.eventFamily === "unknown") {
    qualityFlags.push(qualityFlag("unknown_event_classification", "Parent event could not be classified.", { field: "eventId" }));
  } else if (event.eventFamily.startsWith("excluded-")) {
    qualityFlags.push(qualityFlag("excluded_event_category", `Parent event is classified as ${event.eventFamily}.`, { field: "eventId" }));
  }

  if (scheduledAt.iso && !isWithinDateScope(scheduledAt.iso, input.scopeStartDate, input.scopeEndDate)) {
    qualityFlags.push(qualityFlag("outside_date_scope", "Match falls outside the configured backfill date scope."));
  }
  if (input.isDuplicate) qualityFlags.push(qualityFlag("duplicate_match", "This match ID was already ingested from another discovery path."));
  if (raw.status !== "completed") qualityFlags.push(qualityFlag("not_completed", `Match status is "${raw.status}", not completed.`));
  if (raw.status === "completed" && !winnerId) qualityFlags.push(qualityFlag("inconsistent_winner", "Completed match has no resolvable winner."));
  if (raw.status === "completed" && (!rosterSnapshots || rosterSnapshots.some((roster) => roster.playerInternalIds.length < EXPECTED_ROSTER_SIZE))) {
    qualityFlags.push(qualityFlag("incomplete_roster", "Completed match is missing a full 5-player roster for at least one team.", { field: "rosterSnapshots" }));
  }

  const trainingEligibility = evaluateTrainingEligibility({
    status: raw.status,
    playedAtIso: scheduledAt.iso,
    scopeStartDate: input.scopeStartDate,
    scopeEndDate: input.scopeEndDate,
    eventClassification: event.eventFamily,
    teamAId: teamAIdentity.internalId,
    teamBId: teamBIdentity.internalId,
    winnerId,
    seriesFormat,
    mapWinsForWinner,
    mapsPlayedCount,
    isDuplicate: input.isDuplicate,
    isShowmatch: input.isShowmatch,
    structurallyValid: true,
  });
  if (!trainingEligibility.eligible) {
    qualityFlags.push(qualityFlag("not_training_eligible", `Ineligible: ${trainingEligibility.reasons.join(", ")}.`));
  }

  const { source, ...content } = raw;
  const metadata: IngestionRecordMetadata = {
    provider: "vlr",
    providerExternalId: raw.vlrMatchId,
    sourceUrl: source.sourceUrl,
    fetchedAt: source.fetchedAt,
    parsedAt: input.parsedAt,
    schemaVersion: NORMALIZED_SCHEMA_VERSION,
    contentHash: contentHash(content),
  };

  return {
    internalId: deterministicInternalId("match", raw.vlrMatchId),
    teamAId: teamAIdentity.internalId,
    teamBId: teamBIdentity.internalId,
    winnerId,
    scheduledAt,
    status: raw.status,
    seriesFormat,
    eventId: event.internalId,
    maps,
    rosterSnapshots,
    sourceReference: { provider: "vlr", externalId: raw.vlrMatchId, sourceUrl: source.sourceUrl },
    trainingEligibility,
    qualityFlags,
    metadata,
  };
}
