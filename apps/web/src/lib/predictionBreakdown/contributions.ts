import type { KeyFactor } from "@repo/shared";
import type { ContributionDirection, ContributionRow } from "./types";

/**
 * `KeyFactor.impact` is relative to the predicted *winner* ("positive" means
 * the winner leads on that dimension), not literally Team A/B — this
 * converts it to an actual side using the already-known winner identity.
 */
function directionFor(factor: KeyFactor, predictedWinnerId: string, teamAId: string): ContributionDirection {
  if (factor.magnitude === 0) return "neutral";
  const winnerIsTeamA = predictedWinnerId === teamAId;
  const favorsWinner = factor.impact === "positive";
  if (favorsWinner) return winnerIsTeamA ? "A" : "B";
  return winnerIsTeamA ? "B" : "A";
}

/**
 * Builds the Contributions tab's ranked, percentage-shared rows from
 * `result.keyFactors` exactly as generated — no value is recomputed, only
 * ranked, signed, and given a share-of-total percentage. Pure and
 * deterministic: the same `keyFactors` array always produces the same rows
 * in the same order, regardless of input order (an explicit re-sort, not a
 * reliance on the engine already having sorted them).
 *
 * Zero-total handling: an empty `keyFactors` array (every dimension gap was
 * under the engine's own 8-point threshold) returns `[]` — callers should
 * render the Contributions tab's partial/empty state rather than divide by
 * zero. Ties in magnitude break alphabetically by label, deterministically.
 */
export function buildContributionRows(
  keyFactors: readonly KeyFactor[],
  predictedWinnerId: string,
  teamAId: string,
): ContributionRow[] {
  if (keyFactors.length === 0) return [];

  const totalAbsMagnitude = keyFactors.reduce((sum, factor) => sum + Math.abs(factor.magnitude), 0);

  const ranked = [...keyFactors].sort((a, b) => b.magnitude - a.magnitude || a.label.localeCompare(b.label));

  return ranked.map((factor, index) => {
    const direction = directionFor(factor, predictedWinnerId, teamAId);
    const shareOfTotal = totalAbsMagnitude > 0 ? Math.round((Math.abs(factor.magnitude) / totalAbsMagnitude) * 100) : 0;
    return {
      id: factor.id,
      label: factor.label,
      description: factor.description,
      direction,
      magnitude: factor.magnitude,
      signedMagnitude: direction === "B" ? -factor.magnitude : factor.magnitude,
      shareOfTotal,
      rank: index + 1,
    };
  });
}
