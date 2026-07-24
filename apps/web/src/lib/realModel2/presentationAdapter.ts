import type {
  CurrentPredictionResponse,
  DnaDimensionScore,
  Insight,
  KeyFactor,
  MatchDna,
  PipelineStage,
  PredictionResult,
  RealAxisKey,
  Scenario,
  TeamDna,
} from "@repo/shared";

/**
 * Prediction Studio mode-correction task — Real Model 2.0's presentation
 * adapter. Maps the exact same real backend response
 * (`CurrentPredictionResponse`, produced by `predictCurrentMatch` — the
 * identical real pipeline Real Model 1.0 uses) into a `PredictionResult`
 * shaped object, so the existing Synthetic Scenario result components
 * (`PredictionResultExperience`, `PredictionSummary`, `InteractivePredictionBreakdown`,
 * `WhatIfSimulator`, `MatchDnaSection`, `ExplanationCard`, `KeyFactorsList`,
 * `FeatureContribution`, `InsightsList`, `ResultTimeline`) can render it
 * unmodified. Every value here is read directly off `response`; nothing is
 * recomputed, approximated, or fabricated. See `RealAxisKey` (team-dna.ts)
 * for why this is type-safe without reusing synthetic vocabulary.
 */

export const ELO_SCALE_FLOOR = 1200;
export const ELO_SCALE_SPAN = 600;
const MAP_POOL_BREADTH_REFERENCE_MAX = 12;
const ACTIVITY_REST_REFERENCE_MAX_DAYS = 30;
const COMPETITION_EXPERIENCE_REFERENCE_MAX = 10;

function clamp0To100(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function scaleElo(rating: number): number {
  return clamp0To100(((rating - ELO_SCALE_FLOOR) / ELO_SCALE_SPAN) * 100);
}

function scaleWinRate(rate: number): number {
  return clamp0To100(rate * 100);
}

function scaleMapPoolBreadth(count: number): number {
  return clamp0To100((count / MAP_POOL_BREADTH_REFERENCE_MAX) * 100);
}

function scaleActivityRest(daysSinceLastMatch: number | null): number {
  if (daysSinceLastMatch === null) return 0;
  return clamp0To100(100 - (daysSinceLastMatch / ACTIVITY_REST_REFERENCE_MAX_DAYS) * 100);
}

function scaleCompetitionExperience(count: number): number {
  return clamp0To100((count / COMPETITION_EXPERIENCE_REFERENCE_MAX) * 100);
}

interface RealAxisDefinition {
  key: RealAxisKey;
  label: string;
  /** True only for the one axis the deployed estimator actually consumes. */
  isModelDriver: boolean;
}

const REAL_AXIS_DEFINITIONS: readonly RealAxisDefinition[] = [
  { key: "eloStrength", label: "Elo Strength", isModelDriver: true },
  { key: "recentForm", label: "Recent Form", isModelDriver: false },
  { key: "opponentAdjustedStrength", label: "Opponent-Adjusted Strength", isModelDriver: false },
  { key: "mapPoolBreadth", label: "Map Pool Breadth", isModelDriver: false },
  { key: "scheduleStrength", label: "Strength of Schedule", isModelDriver: false },
  { key: "activityRest", label: "Activity & Rest", isModelDriver: false },
  { key: "competitionExperience", label: "Competition Experience", isModelDriver: false },
];

function scaleAxis(key: RealAxisKey, teamState: CurrentPredictionResponse["teamAState"]): number {
  switch (key) {
    case "eloStrength":
      return scaleElo(teamState.eloRating);
    case "recentForm":
      return scaleWinRate(teamState.recentFormWinRate);
    case "opponentAdjustedStrength":
      return scaleElo(teamState.opponentAdjustedRating);
    case "mapPoolBreadth":
      return scaleMapPoolBreadth(teamState.mapPoolBreadth);
    case "scheduleStrength":
      return scaleElo(teamState.strengthOfSchedule);
    case "activityRest":
      return scaleActivityRest(teamState.daysSinceLastMatch);
    case "competitionExperience":
      return scaleCompetitionExperience(teamState.priorInternationalAppearances + teamState.priorMastersChampionsAppearances);
  }
}

/**
 * Builds `TeamDna` directly from already-computed 0-100 display values
 * (rather than deriving them from raw feature state itself) — this is the
 * shared construction point `buildTeamDna` (baseline) and the What-if
 * Simulator's hypothetical recompute (`simulate.ts`) both funnel through, so
 * "what a dimension value means" is defined in exactly one place.
 */
export function buildTeamDnaFromValues(teamId: string, values: Readonly<Record<RealAxisKey, number>>): TeamDna {
  const dimensions: DnaDimensionScore[] = REAL_AXIS_DEFINITIONS.map((axis) => ({
    key: axis.key,
    label: axis.label,
    value: Math.round(clamp0To100(values[axis.key])),
  }));
  return { teamId, dimensions };
}

export function scaleTeamStateToAxisValues(teamState: CurrentPredictionResponse["teamAState"]): Record<RealAxisKey, number> {
  const values = {} as Record<RealAxisKey, number>;
  for (const axis of REAL_AXIS_DEFINITIONS) values[axis.key] = scaleAxis(axis.key, teamState);
  return values;
}

function buildTeamDna(teamId: string, teamState: CurrentPredictionResponse["teamAState"]): TeamDna {
  return buildTeamDnaFromValues(teamId, scaleTeamStateToAxisValues(teamState));
}

export function buildMatchDna(teamADna: TeamDna, teamBDna: TeamDna): MatchDna {
  const contextAxes = REAL_AXIS_DEFINITIONS.filter((axis) => !axis.isModelDriver);
  const gaps = contextAxes.map((axis) => {
    const a = teamADna.dimensions.find((d) => d.key === axis.key)!.value;
    const b = teamBDna.dimensions.find((d) => d.key === axis.key)!.value;
    return { key: axis.key, gap: Math.abs(a - b) };
  });
  const sorted = [...gaps].sort((x, y) => x.gap - y.gap);
  const complementaryTraits = sorted.slice(0, Math.min(2, sorted.length)).map((g) => g.key);
  const conflictingTraits = [...gaps]
    .sort((x, y) => y.gap - x.gap)
    .slice(0, Math.min(2, gaps.length))
    .map((g) => g.key);
  const avgGap = gaps.reduce((sum, g) => sum + g.gap, 0) / Math.max(1, gaps.length);
  const similarityScore = Math.round(clamp0To100(100 - avgGap));

  return {
    similarityScore,
    complementaryTraits,
    conflictingTraits,
    // The actual model driver, not a context axis — matches section 8's
    // requirement that Elo differential is the decisive real signal.
    decisiveTrait: "eloStrength",
  };
}

/**
 * The subset of a `CurrentPredictionResponse` that `buildKeyFactors`/
 * `buildInsights`/`buildExplanation` actually need — factored out so the
 * What-if Simulator's hypothetical recompute (`simulate.ts`) can build one
 * of these directly from adjusted numbers, without needing a full,
 * artificially-reconstructed `CurrentPredictionResponse`.
 */
export interface RealResultCore {
  teamAId: string;
  teamBId: string;
  estimatorType: string;
  driverLabel: string;
  driverDifferential: number;
  confidence: number;
  evidenceTrustScore: number;
  evidenceTrustExplanation: string;
  teamAWinProbability: number;
}

export function coreFromResponse(response: CurrentPredictionResponse): RealResultCore {
  return {
    teamAId: response.teamAId,
    teamBId: response.teamBId,
    estimatorType: response.estimatorType,
    driverLabel: response.contribution.driverLabel,
    driverDifferential: response.contribution.driverDifferential,
    confidence: response.confidence,
    evidenceTrustScore: response.evidenceTrust.score,
    evidenceTrustExplanation: response.evidenceTrust.explanation,
    teamAWinProbability: response.teamAWinProbability,
  };
}

export function buildKeyFactors(core: RealResultCore, teamADna: TeamDna, teamBDna: TeamDna): KeyFactor[] {
  const favorsTeamA = core.driverDifferential >= 0;

  const factors: KeyFactor[] = [
    {
      id: "eloStrength",
      label: core.driverLabel,
      impact: favorsTeamA ? "positive" : "negative",
      magnitude: Math.min(100, Math.round(Math.abs(core.driverDifferential) / 4)),
      description: `Model contribution: ${core.teamAId} minus ${core.teamBId} Elo is ${core.driverDifferential >= 0 ? "+" : ""}${Math.round(core.driverDifferential)}. This is the only real signal the currently selected ${core.estimatorType} estimator consumes.`,
    },
  ];

  for (const axis of REAL_AXIS_DEFINITIONS) {
    if (axis.isModelDriver) continue;
    const teamAValue = teamADna.dimensions.find((d) => d.key === axis.key)!.value;
    const teamBValue = teamBDna.dimensions.find((d) => d.key === axis.key)!.value;
    factors.push({
      id: axis.key,
      label: axis.label,
      impact: teamAValue >= teamBValue ? "positive" : "negative",
      magnitude: Math.abs(teamAValue - teamBValue),
      description: `Context differential: ${AXIS_DESCRIPTIONS[axis.key]} Context only, not a direct input to the currently selected estimator.`,
    });
  }

  return factors;
}

const AXIS_DESCRIPTIONS: Record<RealAxisKey, string> = {
  eloStrength: "Real Elo rating.",
  recentForm: "Win rate across each team's last 10 real matches.",
  opponentAdjustedStrength: "Average real opponent Elo faced in each team's last 10 matches.",
  mapPoolBreadth: "Count of distinct real maps each team has recorded matches on.",
  scheduleStrength: "Average real opponent Elo across each team's entire match history.",
  activityRest: "Days since each team's last real match (fresher is higher).",
  competitionExperience: "Combined real prior International/Masters/Champions roster appearances.",
};

export function buildInsights(core: RealResultCore, teamAName: string, teamBName: string, keyFactors: KeyFactor[]): Insight[] {
  const favorsTeamA = core.driverDifferential >= 0;
  const favoredName = favorsTeamA ? teamAName : teamBName;

  const contextFactors = keyFactors.filter((f) => f.id !== "eloStrength");
  const favoredSideFactors = contextFactors.filter((f) => (favorsTeamA ? f.impact === "positive" : f.impact === "negative"));
  const oppositeSideFactors = contextFactors.filter((f) => (favorsTeamA ? f.impact === "negative" : f.impact === "positive"));
  const strongest = (list: KeyFactor[]) => [...list].sort((a, b) => b.magnitude - a.magnitude)[0];

  const insights: Insight[] = [
    {
      id: "deciding-factor",
      kind: "deciding-factor",
      title: core.driverLabel,
      description: `The active ${core.estimatorType} estimator's prediction is driven entirely by this signal, favoring ${favoredName}. Every other real metric is supporting context only, not a direct input to today's model.`,
    },
  ];

  const strongestAdvantage = strongest(favoredSideFactors);
  if (strongestAdvantage) {
    insights.push({
      id: "strongest-advantage",
      kind: "advantage",
      title: strongestAdvantage.label,
      description: `${strongestAdvantage.description} The favored side also leads here, though this context differential is not itself a driver of the current estimator.`,
    });
  }

  const biggestWeakness = strongest(oppositeSideFactors);
  if (biggestWeakness) {
    insights.push({
      id: "biggest-weakness",
      kind: "weakness",
      title: biggestWeakness.label,
      description: `${biggestWeakness.description} This is where the favored side trails, though it does not change the current estimator's output.`,
    });
  }

  insights.push({
    id: "confidence-explanation",
    kind: "confidence",
    title: "Model Confidence",
    description: `${Math.round(core.confidence * 100)}% reflects the calibrated probability margin between the two teams, not how much real match history backs this prediction. A close probability split can correctly carry lower confidence even when evidence trust is high.`,
  });

  insights.push({
    id: "trust-score-explanation",
    kind: "confidence",
    title: "Evidence Trust",
    description: `${core.evidenceTrustScore}/100. ${core.evidenceTrustExplanation}`,
  });

  return insights;
}

function buildPipeline(response: CurrentPredictionResponse): PipelineStage[] {
  return response.pipeline.map((stage) => ({
    id: stage.id,
    label: stage.label,
    description: stage.description,
    durationMs: stage.durationMs,
  }));
}

export function buildExplanation(core: RealResultCore, teamAName: string, teamBName: string, keyFactors: KeyFactor[]): string {
  const favorsTeamA = core.driverDifferential >= 0;
  const favoredName = favorsTeamA ? teamAName : teamBName;

  const contextFactors = keyFactors.filter((f) => f.id !== "eloStrength");
  const supporting = contextFactors.filter((f) => (favorsTeamA ? f.impact === "positive" : f.impact === "negative"));
  const supportingClause =
    supporting.length > 0
      ? `Its ${supporting.map((f) => f.label.toLowerCase()).join(" and ")} provide supporting context, but ${supporting.length > 1 ? "these metrics are" : "this metric is"} not a direct driver of the current estimator.`
      : "No supporting real metrics favor this side beyond the primary driver.";

  const closeMarginClause =
    Math.abs(core.teamAWinProbability - 0.5) < 0.1 ? " The probability split is close, so this remains a genuinely competitive matchup." : "";

  const evidenceClause =
    core.evidenceTrustScore < 60 ? ` Evidence trust is limited (${core.evidenceTrustScore}/100): ${core.evidenceTrustExplanation}` : "";

  return `${favoredName} is favored primarily because its ${core.driverLabel.toLowerCase()} is higher. ${supportingClause}${closeMarginClause}${evidenceClause}`;
}

/**
 * The single entry point: `CurrentPredictionResponse` (real) ->
 * `PredictionResult` (the shape every existing Synthetic Scenario result
 * component already renders). `mapIds` comes from the user's own map
 * selection in the shared `ScenarioBuilder` UI — real inference never
 * consumes it (the deployed estimator is map-agnostic), it exists purely so
 * `MatchDnaSection`'s sibling Map Analysis and the What-if Simulator's
 * map-selection area have something to key off, matching the Synthetic
 * layout exactly.
 */
export function mapRealResponseToPredictionResult(
  response: CurrentPredictionResponse,
  teamAName: string,
  teamBName: string,
  mapIds: readonly string[],
): PredictionResult {
  const teamADna = buildTeamDna(response.teamAId, response.teamAState);
  const teamBDna = buildTeamDna(response.teamBId, response.teamBState);
  const matchDna = buildMatchDna(teamADna, teamBDna);
  const core = coreFromResponse(response);
  const keyFactors = buildKeyFactors(core, teamADna, teamBDna);
  const insights = buildInsights(core, teamAName, teamBName, keyFactors);
  const pipeline = buildPipeline(response);
  const explanation = buildExplanation(core, teamAName, teamBName, keyFactors);

  const scenario: Scenario = {
    teamAId: response.teamAId,
    teamBId: response.teamBId,
    seriesFormat: response.seriesFormat === "BO5" ? "BO5" : "BO3",
    mapIds: [...mapIds],
  };

  return {
    predictionId: response.requestId ?? `real-2-${response.teamAId}-${response.teamBId}`,
    requestId: response.requestId ?? "",
    scenario,
    outcomes: [
      { teamId: response.teamAId, winProbability: response.teamAWinProbability },
      { teamId: response.teamBId, winProbability: response.teamBWinProbability },
    ],
    predictedWinnerId: response.predictedWinnerSide === "teamA" ? response.teamAId : response.teamBId,
    confidence: Math.round(response.confidence * 100),
    explanation,
    teamDna: [teamADna, teamBDna],
    matchDna,
    keyFactors,
    insights,
    pipeline,
    warnings: [...response.warnings],
    generatedAt: response.predictionGeneratedAt,
    predictionVersion: response.modelVersion,
    trustScore: response.evidenceTrust.score,
  };
}
