import type { Advantage, DifferenceTier, MapComparisonRow, VctTeamProfile } from "../teamComparison";
import { classifyDifference } from "../teamComparison";

export interface SupportingMetric {
  key: string;
  label: string;
  valueA: number;
  valueB: number;
  advantage: Advantage;
  tier: DifferenceTier;
  magnitude: number;
}

function dnaValue(profile: VctTeamProfile, key: string): number {
  return profile.dna.dimensions.find((dimension) => dimension.key === key)?.value ?? 0;
}

/**
 * The full set of deterministic profile metrics a per-map explanation may
 * draw on — every one is an already-generated profile number, nothing
 * fabricated. Missing DNA dimensions default to 0 rather than throwing.
 */
export function buildSupportingMetrics(profileA: VctTeamProfile, profileB: VctTeamProfile): SupportingMetric[] {
  const rows: Array<[string, string, number, number]> = [
    ["attackStrength", "attack strength", profileA.attackStrength, profileB.attackStrength],
    ["defenseStrength", "defense strength", profileA.defenseStrength, profileB.defenseStrength],
    ["aggression", "aggression", dnaValue(profileA, "aggression"), dnaValue(profileB, "aggression")],
    ["tempo", "tempo", dnaValue(profileA, "tempo"), dnaValue(profileB, "tempo")],
    ["mapControl", "map control", dnaValue(profileA, "mapControl"), dnaValue(profileB, "mapControl")],
    [
      "utilityEfficiency",
      "utility efficiency",
      dnaValue(profileA, "utilityEfficiency"),
      dnaValue(profileB, "utilityEfficiency"),
    ],
    ["adaptability", "adaptability", dnaValue(profileA, "adaptability"), dnaValue(profileB, "adaptability")],
    ["clutchAbility", "clutch ability", dnaValue(profileA, "clutchAbility"), dnaValue(profileB, "clutchAbility")],
    ["consistency", "consistency", profileA.consistency, profileB.consistency],
  ];

  return rows.map(([key, label, valueA, valueB]) => ({
    key,
    label,
    valueA,
    valueB,
    ...classifyDifference(valueA, valueB),
  }));
}

// Keyed on the full DifferenceTier type (including "none") so callers can
// index directly without a narrowing cast — "none" never actually reaches
// these maps, since both call sites are gated behind `row.advantage !==
// "even"`, and tier is only "none" when advantage is "even".
const GAP_QUALIFIER: Record<DifferenceTier, string> = {
  none: "only a small",
  slight: "only a small",
  moderate: "a real",
  strong: "a wide",
};

const EDGE_QUALIFIER: Record<DifferenceTier, string> = {
  none: "slight",
  slight: "slight",
  moderate: "moderate",
  strong: "clear",
};

/**
 * A concise (2-sentence), neutral explanation of why a map leans one way —
 * deterministic, drawn entirely from `buildSupportingMetrics`. No causal
 * claims, no official-data language, no scoreline prediction. Supports the
 * balanced case explicitly rather than forcing a winner.
 */
export function explainMapMatchup(
  row: MapComparisonRow,
  profileA: VctTeamProfile,
  profileB: VctTeamProfile,
  teamAName: string,
  teamBName: string,
): string {
  const metrics = buildSupportingMetrics(profileA, profileB);

  if (row.advantage === "even") {
    const opening = `${row.mapName} is modeled as a close matchup between ${teamAName} and ${teamBName}.`;
    const notable = metrics.filter((metric) => metric.advantage !== "even").sort((a, b) => b.magnitude - a.magnitude).slice(0, 2);

    if (notable.length === 0) {
      return `${opening} Both teams show a similar profile across the tracked metrics, with no single factor standing out.`;
    }

    const holders = notable.map((metric) => `${metric.advantage === "A" ? teamAName : teamBName}'s ${metric.label}`);
    const verb = holders.length === 1 ? "is" : "are";
    return `${opening} ${holders.join(" and ")} ${verb} only a marginal edge, not enough to shift the overall modeled balance.`;
  }

  const leader = row.advantage === "A" ? teamAName : teamBName;
  const trailer = row.advantage === "A" ? teamBName : teamAName;
  const opening = `${row.mapName} is modeled as a ${EDGE_QUALIFIER[row.tier]} ${leader} edge.`;

  const forLeader = metrics
    .filter((metric) => metric.advantage === row.advantage)
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 2);
  const forTrailer = metrics
    .filter((metric) => metric.advantage !== "even" && metric.advantage !== row.advantage)
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 2);

  if (forLeader.length > 0 && forTrailer.length > 0) {
    return `${opening} ${leader}'s stronger ${forLeader.map((metric) => metric.label).join(" and ")} profile offsets ${trailer}'s higher ${forTrailer.map((metric) => metric.label).join(" and ")}, leaving ${GAP_QUALIFIER[row.tier]} overall gap.`;
  }
  if (forLeader.length > 0) {
    return `${opening} ${leader} leads across most tracked metrics, including ${forLeader.map((metric) => metric.label).join(" and ")}.`;
  }
  return `${opening} The modeled map-strength gap does not clearly trace back to a single tracked metric.`;
}
