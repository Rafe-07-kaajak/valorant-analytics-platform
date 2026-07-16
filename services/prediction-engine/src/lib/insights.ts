import type { Insight, KeyFactor, MatchDna, Team, TeamDna } from "@repo/shared";
import type { HeadToHeadRecord } from "./analyticsEngine";
import type { FormWindow } from "./normalizeMatchHistory";

export interface GenerateInsightsInput {
  winner: Team;
  loser: Team;
  winnerDna: TeamDna;
  loserDna: TeamDna;
  matchDna: MatchDna;
  confidence: number;
  trustScore: number;
  /** From the winner's perspective, or null when the two teams have no recorded history. */
  headToHead: HeadToHeadRecord | null;
  winnerRecentForm: FormWindow | null;
  loserRecentForm: FormWindow | null;
  /** Fraction (0-1) of DNA dimensions whose lead direction agrees with the overall verdict — feeds the Confidence explanation. */
  dimensionAgreement: number;
  /** Average (0-1) recency stability across both teams — feeds the Confidence explanation. */
  formStability: number;
  /** Average (0-1) Team DNA feature coverage across both teams — feeds the Trust Score explanation. */
  featureCoverage: number;
}

export function generateKeyFactors({ winner, loser, winnerDna, loserDna }: GenerateInsightsInput): KeyFactor[] {
  const factors: KeyFactor[] = winnerDna.dimensions
    .map((dimension) => {
      const opposing = loserDna.dimensions.find((d) => d.key === dimension.key)!;
      const diff = dimension.value - opposing.value;
      const impact = diff >= 0 ? "positive" : "negative";
      const leader = diff >= 0 ? winner : loser;
      const trailer = diff >= 0 ? loser : winner;
      const leaderValue = diff >= 0 ? dimension.value : opposing.value;
      const trailerValue = diff >= 0 ? opposing.value : dimension.value;

      return {
        id: dimension.key,
        label: dimension.label,
        impact,
        magnitude: Math.abs(diff),
        description: `${leader.name} leads in ${dimension.label.toLowerCase()} (${leaderValue} vs ${trailerValue} for ${trailer.name}).`,
      } satisfies KeyFactor;
    })
    .filter((factor) => factor.magnitude >= 8)
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 4);

  return factors;
}

/**
 * Head-to-head insight from the winner's perspective — omitted entirely when
 * the two teams have no recorded history, per docs/10-prediction-engine.md's
 * "Honesty is preferred over certainty" rather than fabricating one.
 */
function buildHeadToHeadInsight(winner: Team, loser: Team, headToHead: HeadToHeadRecord | null): Insight | null {
  if (!headToHead) return null;

  const winnerWins = headToHead.teamAId === winner.id ? headToHead.teamAWins : headToHead.teamBWins;
  const loserWins = headToHead.matchesPlayed - winnerWins;

  return {
    id: "head-to-head",
    kind: winnerWins >= loserWins ? "advantage" : "weakness",
    title: "Head-to-Head",
    description: `${winner.name} has won ${winnerWins} of their ${headToHead.matchesPlayed} previous ${headToHead.matchesPlayed === 1 ? "meeting" : "meetings"} against ${loser.name} (${loserWins} for ${loser.name}).`,
  };
}

/**
 * Recent-form insight comparing both teams' last-5 win rate — omitted when
 * either team lacks enough recent matches to report a rate, rather than
 * claiming a trend from insufficient data.
 */
function buildRecentFormInsight(
  winner: Team,
  loser: Team,
  winnerRecentForm: FormWindow | null,
  loserRecentForm: FormWindow | null,
): Insight | null {
  if (
    !winnerRecentForm ||
    !loserRecentForm ||
    winnerRecentForm.winRate === null ||
    loserRecentForm.winRate === null
  ) {
    return null;
  }

  const winnerRate = Math.round(winnerRecentForm.winRate * 100);
  const loserRate = Math.round(loserRecentForm.winRate * 100);

  return {
    id: "recent-form",
    kind: winnerRate >= loserRate ? "advantage" : "weakness",
    title: "Recent Form",
    description: `${winner.name} have won ${winnerRecentForm.wins} of their last ${winnerRecentForm.matchesConsidered} matches (${winnerRate}%), while ${loser.name} have won ${loserRecentForm.wins} of their last ${loserRecentForm.matchesConsidered} (${loserRate}%).`,
  };
}

export function generateInsights(
  {
    winner,
    loser,
    winnerDna,
    matchDna,
    confidence,
    trustScore,
    headToHead,
    winnerRecentForm,
    loserRecentForm,
    dimensionAgreement,
    formStability,
    featureCoverage,
  }: Pick<
    GenerateInsightsInput,
    | "winner"
    | "loser"
    | "winnerDna"
    | "matchDna"
    | "confidence"
    | "trustScore"
    | "headToHead"
    | "winnerRecentForm"
    | "loserRecentForm"
    | "dimensionAgreement"
    | "formStability"
    | "featureCoverage"
  >,
  keyFactors: KeyFactor[],
): Insight[] {
  const strongestAdvantage = keyFactors.find((f) => f.impact === "positive");
  const biggestWeakness = keyFactors.find((f) => f.impact === "negative");
  const decisiveDimension = winnerDna.dimensions.find((d) => d.key === matchDna.decisiveTrait)!;

  const insights: Insight[] = [];

  if (strongestAdvantage) {
    insights.push({
      id: "strongest-advantage",
      kind: "advantage",
      title: "Strongest Advantage",
      description: strongestAdvantage.description,
    });
  }

  if (biggestWeakness) {
    insights.push({
      id: "biggest-weakness",
      kind: "weakness",
      title: "Biggest Weakness",
      description: biggestWeakness.description,
    });
  }

  insights.push({
    id: "deciding-factor",
    kind: "deciding-factor",
    title: "Deciding Factor",
    description: `${decisiveDimension.label} shows the widest gap between these two teams and carries the most weight in this prediction.`,
  });

  const headToHeadInsight = buildHeadToHeadInsight(winner, loser, headToHead);
  if (headToHeadInsight) insights.push(headToHeadInsight);

  const recentFormInsight = buildRecentFormInsight(winner, loser, winnerRecentForm, loserRecentForm);
  if (recentFormInsight) insights.push(recentFormInsight);

  insights.push({
    id: "confidence-explanation",
    kind: "confidence",
    title: "Confidence Explanation",
    description: `Confidence sits at ${confidence}% because ${Math.round(dimensionAgreement * 100)}% of measured Team DNA dimensions agree with ${winner.name}, and recent form is ${Math.round(formStability * 100)}% consistent with each team's overall win rate.`,
  });

  insights.push({
    id: "trust-score-explanation",
    kind: "confidence",
    title: "Trust Score Explanation",
    description: `Trust Score sits at ${trustScore}% because both teams have ${Math.round(featureCoverage * 100)}% Team DNA feature coverage from the normalized match history, combined with this prediction's ${confidence}% confidence.`,
  });

  return insights;
}
