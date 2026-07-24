import type { CurrentMatchupRow } from "@repo/vlr-ingestion";
import type {
  CurrentMatchupTeamConfidence,
  RealEvidenceTrust,
  RealHeadToHeadSummary,
  RealMapEvidence,
  RealMatchContribution,
  RealPipelineStage,
  RealSupportingContextFactor,
  RealTeamStateSnapshot,
} from "@repo/shared";

/**
 * Real-model UX-parity task: builds every "beyond bare probability" field of
 * `CurrentPredictionResponse` — team state, model contribution, supporting
 * context, head-to-head, map evidence, and pipeline stages — from the same
 * `CurrentMatchupRow` `currentPredictionAdapter.ts` already builds to score
 * the model. Every value here is read directly off that row or off values
 * `currentPredictionAdapter.ts` already computed; nothing is recomputed,
 * approximated, or fabricated separately.
 */

export function buildTeamStateSnapshot(row: CurrentMatchupRow, side: "teamA" | "teamB", seriesCountInWindow: number): RealTeamStateSnapshot {
  if (side === "teamA") {
    return {
      teamId: row.teamAProviderId,
      isColdStart: row.teamAIsColdStart,
      eloRating: row.teamAEloRating,
      recentFormWinRate: row.teamALast10WinRate,
      formTrend: row.teamAFormTrend,
      opponentAdjustedRating: row.teamAAvgOpponentEloLast10,
      strengthOfSchedule: row.teamAStrengthOfScheduleAllTime,
      mapPoolBreadth: row.teamAMapPoolBreadth,
      recentMapWinRate: row.teamARecentMapWinRateLast10,
      avgRoundsWonPerMap: row.teamAAvgRoundsWonPerMap,
      avgRoundsLostPerMap: row.teamAAvgRoundsLostPerMap,
      daysSinceLastMatch: row.teamADaysSinceLastMatch,
      isBackToBack: row.teamAIsBackToBack,
      priorInternationalAppearances: row.teamARosterPriorInternationalAppearances,
      priorMastersChampionsAppearances: row.teamARosterPriorMastersChampionsAppearances,
      seriesCountInWindow,
    };
  }
  return {
    teamId: row.teamBProviderId,
    isColdStart: row.teamBIsColdStart,
    eloRating: row.teamBEloRating,
    recentFormWinRate: row.teamBLast10WinRate,
    formTrend: row.teamBFormTrend,
    opponentAdjustedRating: row.teamBAvgOpponentEloLast10,
    strengthOfSchedule: row.teamBStrengthOfScheduleAllTime,
    mapPoolBreadth: row.teamBMapPoolBreadth,
    recentMapWinRate: row.teamBRecentMapWinRateLast10,
    avgRoundsWonPerMap: row.teamBAvgRoundsWonPerMap,
    avgRoundsLostPerMap: row.teamBAvgRoundsLostPerMap,
    daysSinceLastMatch: row.teamBDaysSinceLastMatch,
    isBackToBack: row.teamBIsBackToBack,
    priorInternationalAppearances: row.teamBRosterPriorInternationalAppearances,
    priorMastersChampionsAppearances: row.teamBRosterPriorMastersChampionsAppearances,
    seriesCountInWindow,
  };
}

/**
 * `estimatorType` is checked, not assumed, so this stays correct if a future
 * logistic/tree candidate is ever promoted over the current `elo-baseline`
 * — at which point `isSoleDriver` should be revisited alongside whichever
 * real per-feature contribution mechanism that estimator introduces.
 */
export function buildMatchContribution(row: CurrentMatchupRow, estimatorType: string, finalTeamAProbability: number): RealMatchContribution {
  const isEloBaseline = estimatorType === "elo-baseline";
  const uncalibratedProbability = row.teamAEloWinProbability;
  return {
    driverLabel: isEloBaseline ? "Elo rating differential" : `${estimatorType} estimator output`,
    driverDifferential: row.eloRatingDiff,
    uncalibratedProbability,
    calibrationAdjustment: finalTeamAProbability - uncalibratedProbability,
    finalProbability: finalTeamAProbability,
    isSoleDriver: isEloBaseline,
  };
}

function favor(teamAValue: number, teamBValue: number): "teamA" | "teamB" | "even" {
  if (teamAValue === teamBValue) return "even";
  return teamAValue > teamBValue ? "teamA" : "teamB";
}

function favorLowerIsMoreActive(teamADays: number | null, teamBDays: number | null): "teamA" | "teamB" | "even" {
  if (teamADays === null && teamBDays === null) return "even";
  if (teamADays === null) return "teamB";
  if (teamBDays === null) return "teamA";
  if (teamADays === teamBDays) return "even";
  return teamADays < teamBDays ? "teamA" : "teamB";
}

const NON_DRIVING_SUFFIX = " Context only, not a direct input to the currently selected estimator.";

/** Real, honest differentials the active `elo-baseline` estimator does not consume — see `RealSupportingContextFactor`'s doc comment. */
export function buildSupportingContext(row: CurrentMatchupRow): readonly RealSupportingContextFactor[] {
  const teamACompetitionExperience = row.teamARosterPriorInternationalAppearances + row.teamARosterPriorMastersChampionsAppearances;
  const teamBCompetitionExperience = row.teamBRosterPriorInternationalAppearances + row.teamBRosterPriorMastersChampionsAppearances;

  return [
    {
      id: "recent-form",
      label: "Recent Form",
      favoredSide: favor(row.teamALast10WinRate, row.teamBLast10WinRate),
      teamAValue: row.teamALast10WinRate,
      teamBValue: row.teamBLast10WinRate,
      description: "Win rate across each team's last 10 real matches." + NON_DRIVING_SUFFIX,
      isDirectModelInput: false,
    },
    {
      id: "opponent-adjusted-strength",
      label: "Opponent-Adjusted Strength",
      favoredSide: favor(row.teamAAvgOpponentEloLast10, row.teamBAvgOpponentEloLast10),
      teamAValue: row.teamAAvgOpponentEloLast10,
      teamBValue: row.teamBAvgOpponentEloLast10,
      description: "Average real opponent Elo faced in each team's last 10 matches." + NON_DRIVING_SUFFIX,
      isDirectModelInput: false,
    },
    {
      id: "map-pool-breadth",
      label: "Map Pool Breadth",
      favoredSide: favor(row.teamAMapPoolBreadth, row.teamBMapPoolBreadth),
      teamAValue: row.teamAMapPoolBreadth,
      teamBValue: row.teamBMapPoolBreadth,
      description: "Count of distinct real maps each team has recorded matches on." + NON_DRIVING_SUFFIX,
      isDirectModelInput: false,
    },
    {
      id: "schedule-strength",
      label: "Strength of Schedule",
      favoredSide: favor(row.teamAStrengthOfScheduleAllTime, row.teamBStrengthOfScheduleAllTime),
      teamAValue: row.teamAStrengthOfScheduleAllTime,
      teamBValue: row.teamBStrengthOfScheduleAllTime,
      description: "Average real opponent Elo across each team's entire match history." + NON_DRIVING_SUFFIX,
      isDirectModelInput: false,
    },
    {
      id: "activity-rest",
      label: "Activity & Rest",
      favoredSide: favorLowerIsMoreActive(row.teamADaysSinceLastMatch, row.teamBDaysSinceLastMatch),
      teamAValue: row.teamADaysSinceLastMatch ?? -1,
      teamBValue: row.teamBDaysSinceLastMatch ?? -1,
      description: "Days since each team's last real match (-1 means no real match history)." + NON_DRIVING_SUFFIX,
      isDirectModelInput: false,
    },
    {
      id: "competition-experience",
      label: "Competition Experience",
      favoredSide: favor(teamACompetitionExperience, teamBCompetitionExperience),
      teamAValue: teamACompetitionExperience,
      teamBValue: teamBCompetitionExperience,
      description: "Combined real prior International/Masters/Champions roster appearances." + NON_DRIVING_SUFFIX,
      isDirectModelInput: false,
    },
  ];
}

const SATURATING_SERIES_COUNT = 20;
const H2H_TRUST_BONUS_WEIGHT = 0.1;
const H2H_SATURATING_MEETING_COUNT = 5;

function identityConfidenceScore(confidence: CurrentMatchupTeamConfidence["confidence"]): number {
  if (confidence === "verified") return 1;
  if (confidence === "provisional") return 0.5;
  return 0;
}

/** A 0-100 evidence-trust score from real sample size + identity-mapping confidence + head-to-head coverage — deliberately independent of `confidence` (a probability-margin concept), per the task brief's "Model confidence vs. Evidence trust" split. */
export function buildEvidenceTrust(
  row: CurrentMatchupRow,
  teamAConfidence: CurrentMatchupTeamConfidence,
  teamBConfidence: CurrentMatchupTeamConfidence,
): RealEvidenceTrust {
  const teamAScore = (identityConfidenceScore(teamAConfidence.confidence) + Math.min(1, teamAConfidence.seriesCountInWindow / SATURATING_SERIES_COUNT)) / 2;
  const teamBScore = (identityConfidenceScore(teamBConfidence.confidence) + Math.min(1, teamBConfidence.seriesCountInWindow / SATURATING_SERIES_COUNT)) / 2;
  const h2hBonus = Math.min(1, row.h2hPriorMeetingCount / H2H_SATURATING_MEETING_COUNT) * H2H_TRUST_BONUS_WEIGHT;
  const baseScore = (teamAScore + teamBScore) / 2;
  const score = Math.round(Math.min(100, (baseScore + h2hBonus) * 100));

  const explanationParts: string[] = [
    `${teamAConfidence.seriesCountInWindow} real series for team A and ${teamBConfidence.seriesCountInWindow} for team B in the canonical data window.`,
  ];
  if (teamAConfidence.confidence !== "verified" || teamBConfidence.confidence !== "verified") {
    explanationParts.push("At least one team has an unverified or cold-start identity mapping, which lowers evidence trust independent of the predicted probability.");
  }
  explanationParts.push(
    row.h2hPriorMeetingCount > 0
      ? `${row.h2hPriorMeetingCount} prior real meeting(s) between these exact teams.`
      : "No prior real meetings between these exact teams in the canonical window.",
  );

  return {
    score,
    explanation: explanationParts.join(" "),
    teamASeriesCount: teamAConfidence.seriesCountInWindow,
    teamBSeriesCount: teamBConfidence.seriesCountInWindow,
    teamAIdentityConfidence: teamAConfidence.confidence,
    teamBIdentityConfidence: teamBConfidence.confidence,
    h2hMeetingCount: row.h2hPriorMeetingCount,
  };
}

export function buildHeadToHead(row: CurrentMatchupRow): RealHeadToHeadSummary {
  return {
    priorMeetingCount: row.h2hPriorMeetingCount,
    teamAWins: row.h2hTeamAWins,
    teamBWins: row.h2hTeamBWins,
    teamAWinRate: row.h2hTeamAWinRate,
    priorMapDifferential: row.h2hPriorMapDifferential,
    meetingsLast365Days: row.h2hMeetingsLast365Days,
  };
}

const MIN_SERIES_FOR_SUFFICIENT_MAP_EVIDENCE = 10;
const MIN_SERIES_FOR_LIMITED_MAP_EVIDENCE = 3;

/** Aggregate-only — the real feature catalog has no per-map breakdown, so `evidenceLevel` gates the whole aggregate block, never a fabricated per-selected-map score. */
export function buildMapEvidence(row: CurrentMatchupRow, teamASeriesCount: number, teamBSeriesCount: number): RealMapEvidence {
  const minSeriesCount = Math.min(teamASeriesCount, teamBSeriesCount);
  const evidenceLevel: RealMapEvidence["evidenceLevel"] =
    minSeriesCount >= MIN_SERIES_FOR_SUFFICIENT_MAP_EVIDENCE ? "sufficient" : minSeriesCount >= MIN_SERIES_FOR_LIMITED_MAP_EVIDENCE ? "limited" : "none";

  return {
    teamAMapPoolBreadth: row.teamAMapPoolBreadth,
    teamBMapPoolBreadth: row.teamBMapPoolBreadth,
    teamARecentMapWinRate: row.teamARecentMapWinRateLast10,
    teamBRecentMapWinRate: row.teamBRecentMapWinRateLast10,
    teamACumulativeMapWinRate: row.teamACumulativeMapWinRate,
    teamBCumulativeMapWinRate: row.teamBCumulativeMapWinRate,
    teamAAvgRoundsWonPerMap: row.teamAAvgRoundsWonPerMap,
    teamBAvgRoundsWonPerMap: row.teamBAvgRoundsWonPerMap,
    teamAAvgRoundsLostPerMap: row.teamAAvgRoundsLostPerMap,
    teamBAvgRoundsLostPerMap: row.teamBAvgRoundsLostPerMap,
    knownMapPoolOverlapCount: row.knownMapPoolOverlapCount,
    mapStrengthDifferential: row.mapStrengthDifferential,
    evidenceLevel,
  };
}

/**
 * `inferenceDurationMs` (from `PredictionService.predict()`) is measured
 * around preprocessing + estimator scoring + calibration together — there is
 * no separately-measured timing for any single one of those three stages, so
 * the combined real duration is attached to "Run Selected Estimator" (with
 * its description saying so explicitly) rather than split up or duplicated
 * across stages. Every other stage's `durationMs` is `null`: genuinely
 * unmeasured, never invented.
 */
export function buildPipelineStages(inferenceDurationMs: number): readonly RealPipelineStage[] {
  return [
    { id: "match-request", label: "Match Request", description: "Received the selected teams, series format, and tournament tier.", durationMs: null },
    { id: "load-curated-data", label: "Load Curated Match Data", description: "Loaded the real curated match and event dataset as of the canonical data cutoff.", durationMs: null },
    { id: "validate-identity-coverage", label: "Validate Identity and Coverage", description: "Resolved each team's real identity-mapping confidence and in-window series count.", durationMs: null },
    { id: "replay-team-state", label: "Replay Chronological Team State", description: "Replayed the full real match history to obtain each team's current Elo, form, and map state.", durationMs: null },
    { id: "construct-features", label: "Construct Current Matchup Features", description: "Assembled one real, honest feature row for this hypothetical pairing.", durationMs: null },
    { id: "validate-feature-contract", label: "Validate Feature Contract", description: "Checked every feature value against the trained artifact's required inputs and categorical vocabulary.", durationMs: null },
    { id: "apply-preprocessing", label: "Apply Artifact Preprocessing", description: "Standardized numeric features and one-hot encoded categorical features using the artifact's saved preprocessing state.", durationMs: null },
    {
      id: "run-estimator",
      label: "Run Selected Estimator",
      description: "Scored the encoded row with the currently selected estimator (this measurement also covers preprocessing and calibration, timed together as one step).",
      durationMs: inferenceDurationMs,
    },
    { id: "apply-calibration", label: "Apply Calibration", description: "Applied the artifact's saved calibration to the estimator's raw output.", durationMs: null },
    { id: "build-confidence-evidence", label: "Build Confidence and Evidence Report", description: "Computed model confidence and real evidence trust from sample size and identity coverage.", durationMs: null },
    { id: "generate-explanation", label: "Generate Human-Readable Explanation", description: "Built the deterministic explanation from the estimator's actual driver and supporting real context.", durationMs: null },
  ];
}
