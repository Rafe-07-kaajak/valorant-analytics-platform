import type { PoolAggregate } from "./types";

function plural(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/**
 * Deterministic, neutral one-sentence summary of the selected pool — no win
 * probability, no veto/tournament language, no guarantee of an outcome.
 * Pure function of an already-computed `PoolAggregate`.
 */
export function generatePoolSummary(teamAName: string, teamBName: string, aggregate: PoolAggregate): string {
  const poolPhrase =
    aggregate.mapCount === 1 ? "The selected map" : `The selected ${aggregate.mapCount}-map pool`;
  const breakdown = `${aggregate.favoringA} ${plural(aggregate.favoringA, "map", "maps")} favoring ${teamAName}, ${aggregate.favoringB} favoring ${teamBName}, and ${aggregate.close} close ${plural(aggregate.close, "matchup", "matchups")}`;

  if (aggregate.advantage === "even") {
    return `${poolPhrase} is modeled as close overall, with ${breakdown}.`;
  }

  const leader = aggregate.advantage === "A" ? teamAName : teamBName;
  const qualifier = aggregate.tier === "strong" ? "notably" : aggregate.tier === "moderate" ? "moderately" : "slightly";

  return `${poolPhrase} ${qualifier} favors ${leader} overall, with ${breakdown}.`;
}
