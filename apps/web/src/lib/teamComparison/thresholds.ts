import type { Advantage, DifferenceResult, DifferenceThresholds } from "./types";

/**
 * TASK-035 difference classification. Two documented threshold bands:
 *
 * - `PERCENT_SCALE_THRESHOLDS` — for every 0-100 modeled metric (overall
 *   rating, DNA dimensions, attack/defense/economy/clutch/consistency).
 *   A gap under 3 points reads as noise on a 0-100 scale; 3-8 is a real but
 *   small edge; 8-16 is a clear edge; 16+ is a decisive one.
 * - `ROUND_DIFFERENTIAL_THRESHOLDS` — `roundDifferential` is bounded
 *   [-8, 8], a much narrower range, so the percent-scale bands would never
 *   fire "moderate"/"strong" for it. Scaled down proportionally instead:
 *   0.5 rounds/map is a small edge, 1.5 a clear one, 3+ a decisive one.
 *
 * `tier: "none"` always maps to `advantage: "even"` — never declare a
 * winner from a gap too small to be meaningful, regardless of which raw
 * value happens to be larger.
 */
export const PERCENT_SCALE_THRESHOLDS: DifferenceThresholds = {
  slight: 3,
  moderate: 8,
  strong: 16,
};

export const ROUND_DIFFERENTIAL_THRESHOLDS: DifferenceThresholds = {
  slight: 0.5,
  moderate: 1.5,
  strong: 3,
};

export function classifyDifference(
  valueA: number,
  valueB: number,
  thresholds: DifferenceThresholds = PERCENT_SCALE_THRESHOLDS,
): DifferenceResult {
  const magnitude = Math.round(Math.abs(valueA - valueB) * 10) / 10;

  const tier =
    magnitude < thresholds.slight
      ? "none"
      : magnitude < thresholds.moderate
        ? "slight"
        : magnitude < thresholds.strong
          ? "moderate"
          : "strong";

  const advantage: Advantage = tier === "none" ? "even" : valueA > valueB ? "A" : "B";

  return { advantage, tier, magnitude };
}
