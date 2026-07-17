import type { ComparisonFactor } from "./types";

const TOP_FACTORS_PER_TEAM = 2;

function factorPhrase(factors: ComparisonFactor[]): string {
  const labels = factors.map((factor) => factor.title.replace(/ Advantage| Edge$/, "").toLowerCase());
  if (labels.length === 1) return labels[0]!;
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * A deterministic, neutral, one-to-two-sentence summary built from the
 * already-derived factors (see factors.ts) — no new computation, no
 * randomness, no win/loss claim. Picks each team's strongest 1-2 favoring
 * factors (by magnitude) and states them side by side. Falls back to a
 * single balanced sentence when neither team has a meaningful edge, or to a
 * one-sided sentence when every factor favors the same team.
 */
export function generateNeutralSummary(
  teamAName: string,
  teamBName: string,
  factors: readonly ComparisonFactor[],
): string {
  const forA = factors.filter((factor) => factor.advantage === "A").slice(0, TOP_FACTORS_PER_TEAM);
  const forB = factors.filter((factor) => factor.advantage === "B").slice(0, TOP_FACTORS_PER_TEAM);

  if (forA.length === 0 && forB.length === 0) {
    return `${teamAName} and ${teamBName} are modeled as very evenly matched across the tracked profile metrics.`;
  }

  if (forA.length > 0 && forB.length === 0) {
    return `${teamAName} shows a stronger modeled ${factorPhrase(forA)}, with no clear modeled advantage for ${teamBName} in this comparison.`;
  }

  if (forB.length > 0 && forA.length === 0) {
    return `${teamBName} shows a stronger modeled ${factorPhrase(forB)}, with no clear modeled advantage for ${teamAName} in this comparison.`;
  }

  return `${teamAName} shows a stronger modeled ${factorPhrase(forA)}, while ${teamBName} leads in ${factorPhrase(forB)}.`;
}

/**
 * Adapts the shared TASK-031 disclosure ("Predictions use...") for a page
 * that isn't a prediction result — swapping the leading verb phrase (not
 * just the first word) keeps the sentence grammatical ("This comparison
 * uses", not "This comparison use"). The rest of the sentence, including
 * the "modeled estimates, not real statistics" wording, is reused verbatim
 * from the single shared constant rather than duplicated.
 */
export function adaptDisclosureForComparison(disclosure: string): string {
  return disclosure.replace(/^Predictions use\b/, "This comparison uses");
}
