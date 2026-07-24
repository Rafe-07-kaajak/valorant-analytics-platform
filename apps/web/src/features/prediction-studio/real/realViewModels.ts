import type {
  CurrentPredictionResponse,
  Insight,
  KeyFactor,
  RealSupportingContextFactor,
  Team,
  TeamPredictionOutcome,
} from "@repo/shared";
import type { VctTeam } from "../../../constants/vct";
import type { RadarAxis, RadarSeries } from "@repo/ui";

/**
 * Real-model UX-parity task: pure functions turning `CurrentPredictionResponse`
 * (packages/shared/src/types/real-prediction.ts) into the same display-model
 * shapes the synthetic-scenario result already uses (`Team`, `TeamPredictionOutcome`,
 * `KeyFactor`, `Insight`), so the real result can reuse `ResultHeader`,
 * `ProbabilityCard`, `KeyFactorsList`, `FeatureContribution`, and `InsightsList`
 * unmodified rather than duplicating their visual language. Nothing here
 * recomputes a real value; every function only reshapes values the adapter
 * already computed.
 */

export function toSharedTeam(team: VctTeam): Team {
  return { id: team.id, name: team.name, region: team.region, logoUrl: team.logoPath };
}

export function buildOutcomes(result: CurrentPredictionResponse): [TeamPredictionOutcome, TeamPredictionOutcome] {
  return [
    { teamId: result.teamAId, winProbability: result.teamAWinProbability },
    { teamId: result.teamBId, winProbability: result.teamBWinProbability },
  ];
}

/** A relative-gap percentage (0-100) used purely to size a Meter/Badge — never presented as a model weight. `KeyFactor.magnitude` has no fixed unit across the app (synthetic Team DNA gaps are already 0-100-ish), so this keeps the same visual scale honestly for real, differently-united metrics. */
function relativeGapMagnitude(teamAValue: number, teamBValue: number): number {
  const larger = Math.max(Math.abs(teamAValue), Math.abs(teamBValue));
  if (larger === 0) return 0;
  return Math.round((Math.abs(teamAValue - teamBValue) / larger) * 100);
}

/** The single real driver (Elo differential for the deployed `elo-baseline` estimator) as a `KeyFactor` — kept in its own list, never merged with `buildSupportingContextFactors`'s output, per the "Actual Model Contribution vs. Supporting Real Context" split. */
export function buildDriverKeyFactor(result: CurrentPredictionResponse, teamAName: string, teamBName: string): KeyFactor[] {
  const { contribution } = result;
  if (!contribution.isSoleDriver) return [];
  const favorsTeamA = contribution.driverDifferential >= 0;
  return [
    {
      id: "model-driver",
      label: contribution.driverLabel,
      impact: favorsTeamA ? "positive" : "negative",
      magnitude: Math.min(100, Math.round((Math.abs(contribution.driverDifferential) / 4))),
      description: `${teamAName} minus ${teamBName} Elo: ${contribution.driverDifferential >= 0 ? "+" : ""}${Math.round(contribution.driverDifferential)}. This is the only real signal the currently selected ${result.estimatorType} estimator consumes.`,
    },
  ];
}

export function buildSupportingContextFactors(factors: readonly RealSupportingContextFactor[]): KeyFactor[] {
  return factors.map((factor) => ({
    id: factor.id,
    label: factor.label,
    impact: factor.favoredSide === "teamB" ? "negative" : "positive",
    magnitude: relativeGapMagnitude(factor.teamAValue, factor.teamBValue),
    description: factor.description,
  }));
}

/** Strongest Advantage / Biggest Weakness / Deciding Factor + Confidence/Evidence explanations, shaped as `Insight[]` for direct reuse in `InsightsList`. */
export function buildRealInsights(result: CurrentPredictionResponse): Insight[] {
  const insights: Insight[] = [];
  const { contribution, supportingContext, evidenceTrust, confidence } = result;

  insights.push({
    id: "deciding-factor",
    kind: "deciding-factor",
    title: contribution.driverLabel,
    description: `The active ${result.estimatorType} estimator's prediction is driven entirely by this signal. Every other real metric below is supporting context only, not a direct input to today's model.`,
  });

  const bySide = (side: "teamA" | "teamB") => supportingContext.filter((f) => f.favoredSide === side);
  const strongest = (side: "teamA" | "teamB") =>
    bySide(side).sort((a, b) => relativeGapMagnitude(b.teamAValue, b.teamBValue) - relativeGapMagnitude(a.teamAValue, a.teamBValue))[0];

  const favoredSideId = contribution.driverDifferential >= 0 ? "teamA" : "teamB";
  const oppositeSideId = favoredSideId === "teamA" ? "teamB" : "teamA";

  const strongestAdvantage = strongest(favoredSideId);
  if (strongestAdvantage) {
    insights.push({
      id: "strongest-advantage",
      kind: "advantage",
      title: strongestAdvantage.label,
      description: `${strongestAdvantage.description} The favored side also leads here, though this metric is not itself a driver of the current estimator.`,
    });
  }

  const biggestWeakness = strongest(oppositeSideId);
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
    description: `${Math.round(confidence * 100)}% reflects the calibrated probability margin between the two teams, not how much real match history backs this prediction. A close probability split can correctly carry lower confidence.`,
  });

  insights.push({
    id: "evidence-trust-explanation",
    kind: "confidence",
    title: "Evidence Trust",
    description: `${evidenceTrust.score}/100. ${evidenceTrust.explanation}`,
  });

  return insights;
}

const ELO_SCALE_FLOOR = 1200;
const ELO_SCALE_SPAN = 600;
const MAP_POOL_BREADTH_REFERENCE_MAX = 12;

function scaleElo(rating: number): number {
  return Math.min(100, Math.max(0, ((rating - ELO_SCALE_FLOOR) / ELO_SCALE_SPAN) * 100));
}

function scaleWinRate(rate: number): number {
  return Math.min(100, Math.max(0, rate * 100));
}

function scaleMapPoolBreadth(count: number): number {
  return Math.min(100, Math.max(0, (count / MAP_POOL_BREADTH_REFERENCE_MAX) * 100));
}

function scaleMomentum(trend: number): number {
  // FormTrend (Last5WinRate - Last10WinRate) is a signed value roughly in
  // [-0.5, 0.5]; rescaled to 0-100 for the radar's shared 0-100 axis range.
  return Math.min(100, Math.max(0, (trend + 0.5) * 100));
}

export interface RealTeamStateAxisRow {
  readonly key: string;
  readonly label: string;
  readonly teamARaw: number;
  readonly teamBRaw: number;
  readonly teamADisplay: number;
  readonly teamBDisplay: number;
  readonly explanation: string;
  readonly higherIsBetter: boolean;
}

/** Real Team State radar axes — every raw value, its 0-100 display transform, and an explanation, per the task brief's "retain raw value, display transformation, explanation" requirement. Never uses synthetic Team DNA vocabulary (aggression/clutch/etc). */
export function buildRealTeamStateAxisRows(result: CurrentPredictionResponse): RealTeamStateAxisRow[] {
  const { teamAState, teamBState } = result;
  return [
    {
      key: "elo",
      label: "Elo Strength",
      teamARaw: teamAState.eloRating,
      teamBRaw: teamBState.eloRating,
      teamADisplay: scaleElo(teamAState.eloRating),
      teamBDisplay: scaleElo(teamBState.eloRating),
      explanation: `Real Elo rating, scaled from a ${ELO_SCALE_FLOOR}-${ELO_SCALE_FLOOR + ELO_SCALE_SPAN} reference band to 0-100. Higher means a stronger real competitive rating.`,
      higherIsBetter: true,
    },
    {
      key: "recent-form",
      label: "Recent Form",
      teamARaw: teamAState.recentFormWinRate,
      teamBRaw: teamBState.recentFormWinRate,
      teamADisplay: scaleWinRate(teamAState.recentFormWinRate),
      teamBDisplay: scaleWinRate(teamBState.recentFormWinRate),
      explanation: "Win rate across the team's last 10 real matches, shown as a percentage.",
      higherIsBetter: true,
    },
    {
      key: "opponent-adjusted",
      label: "Opponent-Adjusted Strength",
      teamARaw: teamAState.opponentAdjustedRating,
      teamBRaw: teamBState.opponentAdjustedRating,
      teamADisplay: scaleElo(teamAState.opponentAdjustedRating),
      teamBDisplay: scaleElo(teamBState.opponentAdjustedRating),
      explanation: `Average real opponent Elo faced in the last 10 matches, scaled the same way as Elo Strength. Higher means tougher recent competition.`,
      higherIsBetter: true,
    },
    {
      key: "map-depth",
      label: "Map Pool Breadth",
      teamARaw: teamAState.mapPoolBreadth,
      teamBRaw: teamBState.mapPoolBreadth,
      teamADisplay: scaleMapPoolBreadth(teamAState.mapPoolBreadth),
      teamBDisplay: scaleMapPoolBreadth(teamBState.mapPoolBreadth),
      explanation: `Count of distinct real maps played, scaled against a ${MAP_POOL_BREADTH_REFERENCE_MAX}-map reference. Higher means a wider proven map pool.`,
      higherIsBetter: true,
    },
    {
      key: "schedule-strength",
      label: "Strength of Schedule",
      teamARaw: teamAState.strengthOfSchedule,
      teamBRaw: teamBState.strengthOfSchedule,
      teamADisplay: scaleElo(teamAState.strengthOfSchedule),
      teamBDisplay: scaleElo(teamBState.strengthOfSchedule),
      explanation: "Average real opponent Elo across the team's entire match history, scaled the same way as Elo Strength.",
      higherIsBetter: true,
    },
    {
      key: "momentum",
      label: "Momentum",
      teamARaw: teamAState.formTrend,
      teamBRaw: teamBState.formTrend,
      teamADisplay: scaleMomentum(teamAState.formTrend),
      teamBDisplay: scaleMomentum(teamBState.formTrend),
      explanation: "Last-5 win rate minus last-10 win rate, rescaled to 0-100. Above the midpoint means recent results are trending up; no direct 'consistency' metric exists in the real data, so this is the closest honest equivalent.",
      higherIsBetter: true,
    },
  ];
}

export function buildRealTeamStateRadar(result: CurrentPredictionResponse, teamAName: string, teamBName: string): { axes: RadarAxis[]; series: [RadarSeries, RadarSeries] } {
  const rows = buildRealTeamStateAxisRows(result);
  const axes: RadarAxis[] = rows.map((row) => ({ key: row.key, label: row.label }));
  const teamAValues: Record<string, number> = {};
  const teamBValues: Record<string, number> = {};
  for (const row of rows) {
    teamAValues[row.key] = row.teamADisplay;
    teamBValues[row.key] = row.teamBDisplay;
  }
  return {
    axes,
    series: [
      { id: "teamA", label: teamAName, color: "var(--team-a)", values: teamAValues },
      { id: "teamB", label: teamBName, color: "var(--team-b)", values: teamBValues },
    ],
  };
}

export interface RealMatchupProfile {
  readonly similarityScore: number;
  readonly strongestAlignment: RealSupportingContextFactor | null;
  readonly strongestConflict: RealSupportingContextFactor | null;
}

/** Real "matchup similarity" from how often the two teams' supporting-context factors agree vs. disagree on direction — never the synthetic engine's playstyle-similarity concept, since no real playstyle data exists. */
export function buildRealMatchupProfile(result: CurrentPredictionResponse): RealMatchupProfile {
  const { supportingContext } = result;
  if (supportingContext.length === 0) {
    return { similarityScore: 100, strongestAlignment: null, strongestConflict: null };
  }

  const teamAFavoredCount = supportingContext.filter((f) => f.favoredSide === "teamA").length;
  const teamBFavoredCount = supportingContext.filter((f) => f.favoredSide === "teamB").length;
  const evenCount = supportingContext.length - teamAFavoredCount - teamBFavoredCount;
  // "Similar" here means the two teams' real supporting metrics mostly agree
  // (both "even", or lopsided toward the same side) rather than splitting
  // roughly evenly between favoring team A and favoring team B.
  const majorityFavoredCount = Math.max(teamAFavoredCount, teamBFavoredCount);
  const similarityScore = Math.round(((evenCount + majorityFavoredCount) / supportingContext.length) * 100);

  const withGap = [...supportingContext].sort((a, b) => relativeGapMagnitude(b.teamAValue, b.teamBValue) - relativeGapMagnitude(a.teamAValue, a.teamBValue));
  return {
    similarityScore,
    strongestAlignment: withGap[withGap.length - 1]!,
    strongestConflict: withGap[0]!,
  };
}

/** Deterministic, Elo-led narrative, per the task brief's "Why This Prediction" requirement — every clause traceable to a specific real field, never a generated/fabricated claim. */
export function buildRealExplanation(result: CurrentPredictionResponse, teamAName: string, teamBName: string): string {
  const { contribution, supportingContext, evidenceTrust } = result;
  const favorsTeamA = contribution.driverDifferential >= 0;
  const favoredName = favorsTeamA ? teamAName : teamBName;
  const favoredSideId = favorsTeamA ? "teamA" : "teamB";

  const supporting = supportingContext.filter((f) => f.favoredSide === favoredSideId);
  const supportingClause =
    supporting.length > 0
      ? `Its ${supporting.map((f) => f.label.toLowerCase()).join(" and ")} provide supporting context, but ${supporting.length > 1 ? "these" : "this"} metric${supporting.length > 1 ? "s are" : " is"} not a direct driver of the current estimator.`
      : "No supporting real metrics favor this side beyond the primary driver.";

  const closeMarginClause =
    Math.abs(result.teamAWinProbability - 0.5) < 0.1
      ? " The probability split is close, so this remains a genuinely competitive matchup."
      : "";

  const evidenceClause = evidenceTrust.score < 60 ? ` Evidence trust is limited (${evidenceTrust.score}/100): ${evidenceTrust.explanation}` : "";

  return `${favoredName} is favored primarily because its ${contribution.driverLabel.toLowerCase()} is higher. ${supportingClause}${closeMarginClause}${evidenceClause}`;
}
