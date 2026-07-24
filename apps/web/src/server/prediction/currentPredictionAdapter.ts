import type { InferenceRequest, FeatureValue } from "@repo/model-inference";
import { buildCurrentMatchupRow, DEFAULT_ELO_CONFIG } from "@repo/vlr-ingestion";
import type { CurrentMatchupContext, CurrentMatchupRow } from "@repo/vlr-ingestion";
import type { CurrentPredictionResponse, CurrentMatchupTeamConfidence, TournamentTier } from "@repo/shared";
import { getTeamById, type VctTeamId } from "../../constants/vct";
import { computeDataConfidence } from "../../features/power-rankings/rankingModel";
import { getCurrentMatchupDataset } from "./currentMatchupRepository";
import { getPowerRankingsRealData } from "./powerRankingsRepository";
import { getReadyModelService } from "./modelService";
import { PredictionApiError, toPredictionApiError } from "./errors";
import { loadRealPredictionConfig } from "./config";
import {
  buildEvidenceTrust,
  buildHeadToHead,
  buildMapEvidence,
  buildMatchContribution,
  buildPipelineStages,
  buildSupportingContext,
  buildTeamStateSnapshot,
} from "./realTeamStateBuilder";

/**
 * Real "current matchup" prediction — real-model integration for
 * Prediction Studio's main flow. Distinct from `predictionAdapter.ts`
 * (which replays a specific *past* match): this constructs a fresh, honest
 * feature row for an arbitrary team pair "as of" the real data cutoff (see
 * `currentMatchupRow.ts`), then runs it through the exact same real,
 * currently-selected model `predictionAdapter.ts` uses. Never falls back to
 * the synthetic engine on any failure — a caller sees a structured error,
 * never a silently-different prediction mode.
 */

export interface CurrentPredictionInput {
  readonly teamAId: unknown;
  readonly teamBId: unknown;
  readonly seriesFormat: unknown;
  readonly tournamentTier: unknown;
  readonly eventRegion: unknown;
  readonly requestId?: string;
}

const VALID_TOURNAMENT_TIERS: readonly TournamentTier[] = ["league", "international"];
const MAX_STRING_LENGTH = 64;

function validateTeamId(value: unknown, label: string): VctTeamId {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_STRING_LENGTH) {
    throw new PredictionApiError("request_invalid", `${label} must be a non-empty string.`);
  }
  if (!getTeamById(value as VctTeamId)) {
    throw new PredictionApiError("request_invalid", `${label} is not a known VCT team.`);
  }
  return value as VctTeamId;
}

function validateSeriesFormat(value: unknown): string {
  if (typeof value !== "string" || (value !== "BO3" && value !== "BO5")) {
    throw new PredictionApiError("request_invalid", "seriesFormat must be \"BO3\" or \"BO5\".");
  }
  return value;
}

function validateTournamentTier(value: unknown): TournamentTier {
  if (typeof value !== "string" || !VALID_TOURNAMENT_TIERS.includes(value as TournamentTier)) {
    throw new PredictionApiError("request_invalid", "tournamentTier must be \"league\" or \"international\".");
  }
  return value as TournamentTier;
}

/** Builds the model's `features` object strictly from the artifact's own `requiredInputFields` — mirrors `predictionAdapter.ts`'s `buildFeaturesFromRow`, so a field never listed there can never leak into the model input. */
function buildFeaturesFromRow(row: CurrentMatchupRow, requiredInputFields: readonly string[]): Record<string, FeatureValue> {
  const features: Record<string, FeatureValue> = {};
  const record = row as unknown as Record<string, unknown>;
  for (const field of requiredInputFields) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) continue;
    const value = record[field];
    if (value === undefined) continue;
    features[field] = value as FeatureValue;
  }
  return features;
}

export async function predictCurrentMatch(input: CurrentPredictionInput): Promise<CurrentPredictionResponse> {
  const config = loadRealPredictionConfig();
  if (!config.enabled) {
    throw new PredictionApiError("model_unavailable", "Real (current-match) prediction is disabled by configuration.");
  }

  const teamAId = validateTeamId(input.teamAId, "teamAId");
  const teamBId = validateTeamId(input.teamBId, "teamBId");
  if (teamAId === teamBId) {
    throw new PredictionApiError("request_invalid", "teamAId and teamBId must be different teams.");
  }
  const seriesFormat = validateSeriesFormat(input.seriesFormat);
  const tournamentTier = validateTournamentTier(input.tournamentTier);

  let eventRegion: string;
  if (tournamentTier === "league") {
    const teamA = getTeamById(teamAId)!;
    const teamB = getTeamById(teamBId)!;
    if (teamA.region !== teamB.region) {
      throw new PredictionApiError(
        "request_invalid",
        "A regional-league matchup requires both teams to share the same real VCT region; pick \"International\" for a cross-region pairing.",
      );
    }
    eventRegion = typeof input.eventRegion === "string" && input.eventRegion.length > 0 ? input.eventRegion : teamA.region;
  } else {
    eventRegion = "international";
  }

  const dataset = await getCurrentMatchupDataset();
  if (!dataset) {
    throw new PredictionApiError(
      "current_matchup_data_unavailable",
      "The curated real match dataset is not available locally. Run the VLR curation pipeline (`pnpm ingest:vlr:curate`) to enable real current-match prediction.",
    );
  }

  const context: CurrentMatchupContext = { asOfIso: dataset.cutoffIso, seriesFormat, tournamentTier, eventRegion };
  const row = buildCurrentMatchupRow(dataset.matches, dataset.eventsById, teamAId, teamBId, context, DEFAULT_ELO_CONFIG, dataset.sourceDatasetVersion);

  const service = await getReadyModelService();
  const artifact = service.registry.getCurrentArtifact();

  const request: InferenceRequest = {
    requestId: input.requestId,
    featureSchemaVersion: row.featureSchemaVersion,
    featureRulesVersion: row.featureRulesVersion,
    sourceFeatureDatasetVersion: row.sourceDatasetVersion,
    features: artifact ? buildFeaturesFromRow(row, artifact.featureContract.requiredInputFields) : {},
  };

  let response;
  try {
    response = await service.predict(request);
  } catch (error) {
    throw toPredictionApiError(error);
  }

  const realData = await getPowerRankingsRealData();
  const buildTeamConfidence = (teamId: VctTeamId): CurrentMatchupTeamConfidence => {
    const state = realData?.states.get(teamId);
    const identityVerified = realData?.verifiedTeamIds.has(teamId) ?? false;
    return {
      teamId,
      confidence: computeDataConfidence(state, identityVerified),
      seriesCountInWindow: state?.seriesCountInWindow ?? 0,
    };
  };
  const teamAConfidence = buildTeamConfidence(teamAId);
  const teamBConfidence = buildTeamConfidence(teamBId);

  const warnings = [...response.warnings];
  for (const teamConfidence of [teamAConfidence, teamBConfidence]) {
    if (teamConfidence.confidence !== "verified") {
      const team = getTeamById(teamConfidence.teamId as VctTeamId);
      warnings.push(
        teamConfidence.confidence === "unrated"
          ? `${team?.name ?? teamConfidence.teamId} has no real match history in the canonical data window: this prediction relies entirely on cold-start defaults for that team.`
          : `${team?.name ?? teamConfidence.teamId} has limited real match history (${teamConfidence.seriesCountInWindow} matches) or an unverified identity mapping: treat this prediction with reduced confidence for that team.`,
      );
    }
  }

  return {
    mode: "current-real-model",
    requestId: response.requestId,
    teamAId,
    teamBId,
    seriesFormat,
    tournamentTier,
    eventRegion,
    modelVersion: response.modelVersion,
    estimatorType: response.estimatorType,
    calibrationMethod: response.calibrationMethod,
    teamAWinProbability: response.teamAWinProbability,
    teamBWinProbability: response.teamBWinProbability,
    predictedWinnerSide: response.predictedWinnerSide,
    confidence: response.confidence,
    warnings,
    predictionGeneratedAt: response.predictionGeneratedAt,
    inferenceDurationMs: response.inferenceDurationMs,
    dataProvenance: {
      sourceFeatureDatasetVersion: response.sourceFeatureDatasetVersion,
      featureSchemaVersion: response.featureSchemaVersion,
      canonicalWindowStartIso: realData?.canonicalWindow.windowStartIso ?? dataset.cutoffIso,
      modelTrainDateRangeEndIso: artifact?.manifest.trainDateRangeEndIso ?? null,
      asOfIso: dataset.cutoffIso,
      constructedFromRealFeatureData: true,
    },
    teamAConfidence,
    teamBConfidence,
    teamAState: buildTeamStateSnapshot(row, "teamA", teamAConfidence.seriesCountInWindow),
    teamBState: buildTeamStateSnapshot(row, "teamB", teamBConfidence.seriesCountInWindow),
    contribution: buildMatchContribution(row, response.estimatorType, response.teamAWinProbability),
    supportingContext: buildSupportingContext(row),
    evidenceTrust: buildEvidenceTrust(row, teamAConfidence, teamBConfidence),
    headToHead: buildHeadToHead(row),
    mapEvidence: buildMapEvidence(row, teamAConfidence.seriesCountInWindow, teamBConfidence.seriesCountInWindow),
    pipeline: buildPipelineStages(response.inferenceDurationMs),
  };
}
