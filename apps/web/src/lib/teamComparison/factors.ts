import type { ComparisonFactor, VctTeamProfile } from "./types";
import { classifyDifference } from "./thresholds";

function dimensionValue(profile: VctTeamProfile, key: string): number {
  return profile.dna.dimensions.find((dimension) => dimension.key === key)?.value ?? 0;
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function qualifierFor(tier: ComparisonFactor["tier"]): string {
  return tier === "strong" ? "notably" : tier === "moderate" ? "moderately" : "slightly";
}

function describeEdge(
  teamAName: string,
  teamBName: string,
  factorLabel: string,
  advantage: ComparisonFactor["advantage"],
  tier: ComparisonFactor["tier"],
): string {
  if (advantage === "even") {
    return `${teamAName} and ${teamBName} show a similar modeled ${factorLabel.toLowerCase()}.`;
  }
  const leader = advantage === "A" ? teamAName : teamBName;
  const trailer = advantage === "A" ? teamBName : teamAName;
  return `${leader} shows a ${qualifierFor(tier)} stronger modeled ${factorLabel.toLowerCase()} than ${trailer}.`;
}

/**
 * Derives the "most important profile differences" between two teams —
 * every factor is a deterministic function of already-generated profile
 * numbers (DNA dimensions, modeled ratings, map strength), sorted by
 * magnitude so the biggest gaps surface first. No causal or win-likelihood
 * language — these describe the modeled profiles, not a match outcome.
 */
export function deriveFactors(
  profileA: VctTeamProfile,
  profileB: VctTeamProfile,
  teamAName: string,
  teamBName: string,
): ComparisonFactor[] {
  const factors: ComparisonFactor[] = [];

  const dimensionFactor = (id: string, title: string, dnaKey: string) => {
    const valueA = dimensionValue(profileA, dnaKey);
    const valueB = dimensionValue(profileB, dnaKey);
    const difference = classifyDifference(valueA, valueB);
    factors.push({
      id,
      title,
      description: describeEdge(teamAName, teamBName, title, difference.advantage, difference.tier),
      ...difference,
    });
  };

  dimensionFactor("aggression", "Aggression Advantage", "aggression");
  dimensionFactor("map-control", "Map Control Advantage", "mapControl");
  dimensionFactor("adaptability", "Adaptability Advantage", "adaptability");

  const scalarFactor = (id: string, title: string, key: "economyEfficiency" | "clutchPerformance" | "consistency") => {
    const difference = classifyDifference(profileA[key], profileB[key]);
    factors.push({
      id,
      title,
      description: describeEdge(teamAName, teamBName, title, difference.advantage, difference.tier),
      ...difference,
    });
  };

  scalarFactor("economy-edge", "Economy Edge", "economyEfficiency");
  scalarFactor("clutch-edge", "Clutch Edge", "clutchPerformance");
  scalarFactor("consistency-edge", "Consistency Edge", "consistency");

  // Attack/defense balance: which team's attack-vs-defense modeled skew is
  // smaller (i.e. more evenly capable on both sides) rather than declaring
  // either "attack" or "defense" itself a win condition.
  const skewA = profileA.attackStrength - profileA.defenseStrength;
  const skewB = profileB.attackStrength - profileB.defenseStrength;
  const balanceDifference = classifyDifference(-Math.abs(skewA), -Math.abs(skewB));
  factors.push({
    id: "attack-defense-balance",
    title: "Attack/Defense Balance",
    description:
      balanceDifference.advantage === "even"
        ? `${teamAName} and ${teamBName} show a similar modeled balance between attack and defense.`
        : `${balanceDifference.advantage === "A" ? teamAName : teamBName} is ${qualifierFor(balanceDifference.tier)} more balanced between attack (${Math.round(
            balanceDifference.advantage === "A" ? profileA.attackStrength : profileB.attackStrength,
          )}) and defense (${Math.round(
            balanceDifference.advantage === "A" ? profileA.defenseStrength : profileB.defenseStrength,
          )}) than ${balanceDifference.advantage === "A" ? teamBName : teamAName}.`,
    ...balanceDifference,
  });

  // Map-pool depth: lower spread across mapStrength values reads as a
  // deeper, less map-dependent pool rather than a few standout/weak maps.
  const spreadA = standardDeviation(Object.values(profileA.mapStrength));
  const spreadB = standardDeviation(Object.values(profileB.mapStrength));
  const depthDifference = classifyDifference(-spreadA, -spreadB);
  factors.push({
    id: "map-pool-depth",
    title: "Map Pool Depth",
    description:
      depthDifference.advantage === "even"
        ? `${teamAName} and ${teamBName} show a similar modeled map-pool depth.`
        : `${depthDifference.advantage === "A" ? teamAName : teamBName} shows a ${qualifierFor(depthDifference.tier)} more consistent modeled map pool than ${depthDifference.advantage === "A" ? teamBName : teamAName}.`,
    ...depthDifference,
  });

  return factors.sort((a, b) => b.magnitude - a.magnitude);
}
