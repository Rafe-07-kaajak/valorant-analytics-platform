/**
 * Browser-safe contracts for TASK-047's real (historical-replay) prediction
 * integration — see docs/35-real-prediction-backend-integration.md. These
 * types describe only what may cross the server/client boundary: safe match
 * metadata, model provenance, and a probability. They never carry a raw
 * feature row, an artifact path, or a label/actual-result field.
 *
 * `PredictionResult` (./prediction.ts) — the synthetic-scenario engine's own
 * contract — is deliberately left untouched by this file; the two modes are
 * unified only at the display layer (see `apps/web`'s `PredictionDisplayResult`),
 * never by changing the synthetic engine's existing contract.
 */

export type PredictionMode = "synthetic-scenario" | "historical-real-model" | "current-real-model";

export interface HistoricalMatchSummary {
  readonly matchInternalId: string;
  readonly scheduledAt: string;
  readonly eventFamily: string;
  /** Official event name (e.g. "Valorant Masters Santiago 2026") — see docs/32, "Region/Team Metadata Policy"; resolved from the source event record, never guessed. */
  readonly eventName: string;
  readonly eventRegion: string;
  readonly tournamentLevel: string;
  /** Per-match round/bracket text for display (e.g. "Grand Final Playoffs"). */
  readonly matchStageDisplay: string;
  readonly seriesFormat: string;
  readonly teamAProviderId: string;
  readonly teamBProviderId: string;
  /** Human-readable team names for display; `teamAProviderId`/`teamBProviderId` remain the canonical identifiers. */
  readonly teamADisplayName: string;
  readonly teamBDisplayName: string;
  readonly modelEligible: boolean;
  readonly featureDatasetVersion: string;
}

export interface HistoricalCatalogResponse {
  readonly matches: readonly HistoricalMatchSummary[];
  readonly total: number;
  readonly featureDatasetVersion: string;
}

export interface HistoricalPredictionRequest {
  readonly mode: "historical-real-model";
  readonly matchInternalId: string;
  readonly requestId?: string;
  readonly requestedModelVersion?: string;
}

export interface HistoricalMatchMetadata {
  readonly matchInternalId: string;
  readonly scheduledAt: string;
  readonly eventFamily: string;
  readonly eventName: string;
  readonly eventRegion: string;
  readonly tournamentLevel: string;
  readonly matchStageDisplay: string;
  readonly seriesFormat: string;
  readonly teamAProviderId: string;
  readonly teamBProviderId: string;
  readonly teamADisplayName: string;
  readonly teamBDisplayName: string;
}

/**
 * Whether the model actually could have existed at the replayed match's
 * date, distinct from `generatedFromHistoricalSnapshot` (which is about
 * *feature* correctness — always true — not *model* correctness). A single
 * trained model is applied uniformly to every historical match; if the
 * match falls within (or after) the model's own training window, the model
 * was necessarily trained using data from that period or later, so its
 * prediction cannot claim genuine point-in-time fidelity for that match.
 */
export type TemporalFidelity = "point-in-time" | "retrospective";

export interface PredictionDataProvenance {
  readonly sourceFeatureDatasetVersion: string;
  readonly featureSchemaVersion: string;
  /** Always `true` for this mode — the prediction was generated from a pre-match snapshot, never live/future data. */
  readonly generatedFromHistoricalSnapshot: true;
  /** The active model's training-data cutoff, or `null` when unknown (e.g. model unavailable). */
  readonly modelTrainDateRangeEndIso: string | null;
  /** See `TemporalFidelity`'s doc comment. Defaults to `"retrospective"` (the conservative/honest label) whenever the model's train cutoff can't be determined. */
  readonly temporalFidelity: TemporalFidelity;
}

export interface HistoricalResultAvailability {
  /** Whether the actual historical outcome could be revealed after the prediction is shown. Reveal itself is a future enhancement (see docs/35, "Known limitations") — this only advertises the possibility. */
  readonly actualResultRevealable: boolean;
}

export type PredictedWinnerSide = "teamA" | "teamB";

export interface HistoricalPredictionResponse {
  readonly mode: "historical-real-model";
  readonly requestId?: string;
  readonly match: HistoricalMatchMetadata;
  readonly modelVersion: string;
  readonly estimatorType: string;
  readonly calibrationMethod: string;
  readonly sourceFeatureDatasetVersion: string;
  readonly featureSchemaVersion: string;
  readonly teamAWinProbability: number;
  readonly teamBWinProbability: number;
  readonly predictedWinnerSide: PredictedWinnerSide;
  readonly confidence: number;
  readonly warnings: readonly string[];
  readonly predictionGeneratedAt: string;
  readonly inferenceDurationMs: number;
  readonly dataProvenance: PredictionDataProvenance;
  readonly resultAvailability: HistoricalResultAvailability;
}

/**
 * Real "current matchup" prediction contract — real-model integration for
 * Prediction Studio's main flow (distinct from `HistoricalPredictionResponse`,
 * which replays a specific *past* match; this predicts an arbitrary,
 * not-yet-scheduled pairing "as of" the real data cutoff). See
 * `services/vlr-ingestion/src/feature/currentMatchupRow.ts` for how the
 * underlying feature row is constructed from 100% real per-team state, with
 * only the competitive-tier assumption supplied explicitly by the caller.
 */
export type TournamentTier = "league" | "international";

export interface CurrentPredictionRequest {
  readonly mode: "current-real-model";
  readonly teamAId: string;
  readonly teamBId: string;
  readonly seriesFormat: string;
  readonly tournamentTier: TournamentTier;
  /** Required (and must be a real region shared by both teams) when `tournamentTier` is `"league"`; ignored for `"international"`. */
  readonly eventRegion?: string;
  readonly requestId?: string;
}

/** A single team's real-data trust tier for this specific prediction — see `apps/web`'s `rankingModel.ts#computeDataConfidence`, reused here so Power Rankings and Prediction Studio never disagree about what "verified" means. */
export interface CurrentMatchupTeamConfidence {
  readonly teamId: string;
  readonly confidence: "verified" | "provisional" | "unrated";
  readonly seriesCountInWindow: number;
}

export interface CurrentPredictionDataProvenance {
  readonly sourceFeatureDatasetVersion: string;
  readonly featureSchemaVersion: string;
  readonly canonicalWindowStartIso: string;
  readonly modelTrainDateRangeEndIso: string | null;
  /** The real data cutoff this prediction's feature row was constructed "as of" — the true end of ingested history, never wall-clock time. */
  readonly asOfIso: string;
  /** Always `true` — every non-tier input to this prediction came from real ingested match history, never a synthetic profile. */
  readonly constructedFromRealFeatureData: true;
}

/**
 * One team's real, pre-match state — every value read directly off the same
 * `CurrentMatchupRow` the model itself was scored against (see
 * `services/vlr-ingestion/src/feature/currentMatchupRow.ts`), never a
 * separately-derived or fabricated number. Field names intentionally avoid
 * synthetic Team DNA vocabulary ("aggression", "clutchAbility", etc.) — no
 * real equivalent exists for those; see docs on `RealSupportingContextFactor`.
 */
export interface RealTeamStateSnapshot {
  readonly teamId: string;
  /** True when this team had zero real curated match appearances as of the data cutoff — every other field is then a cold-start default, not a fabricated history. */
  readonly isColdStart: boolean;
  readonly eloRating: number;
  /** Win rate across the team's last 10 real matches. */
  readonly recentFormWinRate: number;
  /** Last-5 win rate minus last-10 win rate — positive means recent results are trending up. */
  readonly formTrend: number;
  /** Average Elo rating of opponents faced in the last 10 real matches — a real opponent-strength adjustment, not a raw win rate. */
  readonly opponentAdjustedRating: number;
  /** Average opponent Elo across the team's entire real match history. */
  readonly strengthOfSchedule: number;
  /** Count of distinct real maps the team has recorded matches on — real map-pool breadth, not a per-map score. */
  readonly mapPoolBreadth: number;
  /** Map win rate across the last 10 real maps played. */
  readonly recentMapWinRate: number;
  readonly avgRoundsWonPerMap: number;
  readonly avgRoundsLostPerMap: number;
  /** Days since the team's last real match as of the data cutoff, or `null` if it has none. */
  readonly daysSinceLastMatch: number | null;
  readonly isBackToBack: boolean;
  readonly priorInternationalAppearances: number;
  readonly priorMastersChampionsAppearances: number;
  /** Real match count inside the canonical data window — the same figure `CurrentMatchupTeamConfidence.seriesCountInWindow` reports, repeated here so the team-state card is self-contained. */
  readonly seriesCountInWindow: number;
}

/**
 * The currently-selected estimator's actual driving signal, kept generic so
 * a future logistic/tree estimator can populate the same shape with its own
 * real driver — never hardcoded to Elo at the type level, even though the
 * deployed `elo-baseline` estimator is the only implementation today.
 */
export interface RealMatchContribution {
  /** Human-readable name of the real signal the active estimator actually consumed (e.g. "Elo rating differential" for `elo-baseline`). */
  readonly driverLabel: string;
  /** The primary driver's raw differential (team A minus team B) in its own native unit — Elo points for the current estimator. */
  readonly driverDifferential: number;
  /** The estimator's own probability estimate for team A, before calibration is applied. */
  readonly uncalibratedProbability: number;
  /** `finalProbability - uncalibratedProbability`. */
  readonly calibrationAdjustment: number;
  readonly finalProbability: number;
  /** True when the active estimator's prediction is derived from this one driver alone (true for `elo-baseline`) — tells the UI whether every other real metric must be labeled as non-driving context. */
  readonly isSoleDriver: boolean;
}

export type RealContextFactorId =
  | "recent-form"
  | "opponent-adjusted-strength"
  | "map-pool-breadth"
  | "schedule-strength"
  | "activity-rest"
  | "competition-experience";

/**
 * A real, honest differential between the two teams that is NOT (today)
 * consumed by the active estimator — supporting context only. Never rendered
 * as if it were a model weight; see section 10/CLAUDE.md task brief's
 * "Actual Model Contribution vs. Supporting Real Context" split.
 */
export interface RealSupportingContextFactor {
  readonly id: RealContextFactorId;
  readonly label: string;
  readonly favoredSide: "teamA" | "teamB" | "even";
  readonly teamAValue: number;
  readonly teamBValue: number;
  readonly description: string;
  /** Always `false` while the deployed estimator is `elo-baseline` (it consumes no categorical/contextual feature) — kept as a field, not assumed, so a future estimator that genuinely does consume one of these can flip it honestly. */
  readonly isDirectModelInput: boolean;
}

/**
 * Sample size / identity / coverage trust — deliberately distinct from
 * `confidence` (a probability-margin/calibration concept). A 56/44 split can
 * correctly carry low confidence; a lopsided 80/20 split can correctly carry
 * low evidence trust if either team has almost no real match history.
 */
export interface RealEvidenceTrust {
  /** 0-100. */
  readonly score: number;
  readonly explanation: string;
  readonly teamASeriesCount: number;
  readonly teamBSeriesCount: number;
  readonly teamAIdentityConfidence: "verified" | "provisional" | "unrated";
  readonly teamBIdentityConfidence: "verified" | "provisional" | "unrated";
  readonly h2hMeetingCount: number;
}

export interface RealHeadToHeadSummary {
  readonly priorMeetingCount: number;
  readonly teamAWins: number;
  readonly teamBWins: number;
  readonly teamAWinRate: number;
  readonly priorMapDifferential: number;
  readonly meetingsLast365Days: number;
}

/**
 * Aggregate-only map evidence — the real feature catalog has no per-map
 * breakdown (see `services/vlr-ingestion/src/feature/featureCatalog.ts`), so
 * this is never a per-selected-map score, only pool-wide real aggregates.
 */
export interface RealMapEvidence {
  readonly teamAMapPoolBreadth: number;
  readonly teamBMapPoolBreadth: number;
  readonly teamARecentMapWinRate: number;
  readonly teamBRecentMapWinRate: number;
  readonly teamACumulativeMapWinRate: number;
  readonly teamBCumulativeMapWinRate: number;
  readonly teamAAvgRoundsWonPerMap: number;
  readonly teamBAvgRoundsWonPerMap: number;
  readonly teamAAvgRoundsLostPerMap: number;
  readonly teamBAvgRoundsLostPerMap: number;
  readonly knownMapPoolOverlapCount: number;
  readonly mapStrengthDifferential: number;
  /** Whether both teams have enough real series in-window for the above to be meaningful, rather than cold-start defaults. */
  readonly evidenceLevel: "sufficient" | "limited" | "none";
}

export interface RealPipelineStage {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Real measured duration in milliseconds, or `null` when this stage's timing isn't separately measured — never a fabricated estimate. */
  readonly durationMs: number | null;
}

export interface CurrentPredictionResponse {
  readonly mode: "current-real-model";
  readonly requestId?: string;
  readonly teamAId: string;
  readonly teamBId: string;
  readonly seriesFormat: string;
  readonly tournamentTier: TournamentTier;
  readonly eventRegion: string;
  readonly modelVersion: string;
  readonly estimatorType: string;
  readonly calibrationMethod: string;
  readonly teamAWinProbability: number;
  readonly teamBWinProbability: number;
  readonly predictedWinnerSide: PredictedWinnerSide;
  readonly confidence: number;
  readonly warnings: readonly string[];
  readonly predictionGeneratedAt: string;
  readonly inferenceDurationMs: number;
  readonly dataProvenance: CurrentPredictionDataProvenance;
  readonly teamAConfidence: CurrentMatchupTeamConfidence;
  readonly teamBConfidence: CurrentMatchupTeamConfidence;
  readonly teamAState: RealTeamStateSnapshot;
  readonly teamBState: RealTeamStateSnapshot;
  readonly contribution: RealMatchContribution;
  readonly supportingContext: readonly RealSupportingContextFactor[];
  readonly evidenceTrust: RealEvidenceTrust;
  readonly headToHead: RealHeadToHeadSummary;
  readonly mapEvidence: RealMapEvidence;
  readonly pipeline: readonly RealPipelineStage[];
}

export type PredictionErrorCode =
  | "model_unavailable"
  | "model_loading"
  | "historical_data_unavailable"
  | "historical_match_not_found"
  | "feature_dataset_version_mismatch"
  | "feature_row_invalid"
  | "model_version_mismatch"
  | "inference_validation_failed"
  | "inference_failed"
  | "request_invalid"
  | "internal_error"
  | "runtime_package_missing"
  | "runtime_package_manifest_invalid"
  | "runtime_package_hash_mismatch"
  | "runtime_package_version_mismatch"
  | "runtime_package_model_mismatch"
  | "runtime_package_feature_mismatch"
  | "runtime_package_row_count_mismatch"
  | "runtime_package_unsafe_path"
  | "runtime_package_unsupported_target"
  | "current_matchup_data_unavailable";

export interface PredictionApiErrorPayload {
  readonly code: PredictionErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly requestId?: string;
}

export type ModelRegistryStatus = "unloaded" | "loading" | "ready" | "degraded" | "failed";

/** TASK-048: which data source the real-prediction backend is currently configured to read from. */
export type RealPredictionSourceMode = "local-generated" | "runtime-package";

export interface RealPredictionReadiness {
  readonly realPredictionAvailable: boolean;
  readonly modelStatus: ModelRegistryStatus;
  readonly historicalDataAvailable: boolean;
  readonly currentModelVersion?: string;
  readonly sourceFeatureDatasetVersion?: string;
  readonly message: string;
  readonly retryable: boolean;
  /** TASK-048: which source mode served this readiness snapshot. */
  readonly sourceMode?: RealPredictionSourceMode;
  /** TASK-048: only present when `sourceMode` is `"runtime-package"`. */
  readonly runtimePackageVersion?: string;
}
