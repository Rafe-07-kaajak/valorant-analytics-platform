import type { Insight, KeyFactor, MatchDna, Team, TeamDna } from "@repo/shared";

interface GenerateInsightsInput {
  winner: Team;
  loser: Team;
  winnerDna: TeamDna;
  loserDna: TeamDna;
  matchDna: MatchDna;
  confidence: number;
  trustScore: number;
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

export function generateInsights({
  winner,
  loser,
  winnerDna,
  loserDna,
  matchDna,
  confidence,
  trustScore,
}: GenerateInsightsInput): Insight[] {
  const factors = generateKeyFactors({ winner, loser, winnerDna, loserDna, matchDna, confidence, trustScore });
  const strongestAdvantage = factors.find((f) => f.impact === "positive");
  const biggestWeakness = factors.find((f) => f.impact === "negative");
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

  insights.push({
    id: "confidence-explanation",
    kind: "confidence",
    title: "Confidence Explanation",
    description: `This prediction carries ${confidence}% confidence and a ${trustScore}% trust score, reflecting mock data coverage rather than a live analytical pipeline.`,
  });

  return insights;
}
