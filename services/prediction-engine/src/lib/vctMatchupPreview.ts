import type { MatchDna } from "@repo/shared";
import type { VctTeamId } from "../data/vctTeams";
import { computeDimensionAgreement, computeWeightedAdvantage, generateMatchDna } from "./matchDna";
import { getVctTeamProfile } from "./vctTeamProfiles";

/**
 * Proves the TASK-031 profile layer is structurally compatible with the
 * existing prediction math (`generateMatchDna`, `computeWeightedAdvantage`,
 * `computeDimensionAgreement` — all unmodified) without wiring the new
 * 32-team roster into the live `generatePrediction` path or `/api/teams`.
 * TASK-032 decides if/how this becomes user-facing.
 */
export interface VctMatchupPreview {
  teamAId: VctTeamId;
  teamBId: VctTeamId;
  matchDna: MatchDna;
  /** Positive favors team A, negative favors team B — same convention as `computeWeightedAdvantage`. */
  weightedAdvantage: number;
  dimensionAgreement: number;
}

export function previewVctMatchup(teamAId: VctTeamId, teamBId: VctTeamId): VctMatchupPreview {
  if (teamAId === teamBId) {
    throw new Error("A VCT team cannot be matched up against itself.");
  }

  const teamA = getVctTeamProfile(teamAId);
  const teamB = getVctTeamProfile(teamBId);
  if (!teamA || !teamB) {
    throw new Error("Unknown VCT team id in matchup preview.");
  }

  const matchDna = generateMatchDna(teamA.dna, teamB.dna);
  const weightedAdvantage = computeWeightedAdvantage(teamA.dna, teamB.dna);
  const dimensionAgreement = computeDimensionAgreement(teamA.dna, teamB.dna, weightedAdvantage);

  return { teamAId, teamBId, matchDna, weightedAdvantage, dimensionAgreement };
}
