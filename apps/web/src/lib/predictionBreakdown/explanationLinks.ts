import type { DnaDimensionKey, PredictionResult } from "@repo/shared";
import type { ExplanationFragment } from "./types";

/**
 * Splits `result.explanation` into sentences and associates each one with a
 * `DnaDimensionKey` only where that association is deterministically known
 * from the exact generation pattern (`generatePrediction.ts`/
 * `generateVctPrediction.ts`, mirrored):
 *
 *   `"${winner} is favored primarily due to a ${topFactor.label.toLowerCase()}
 *      advantage over ${loser}. ${decidingFactorInsight.description}"`
 *
 * Sentence 1 always names `keyFactors[0].label` (lowercased) when a top
 * factor exists — that's `keyFactors[0].id`, a `DnaDimensionKey`. Sentence 2
 * is exactly the "Deciding Factor" insight, which always opens with
 * `matchDna.decisiveTrait`'s dimension label. Both checks are plain,
 * case-aware substring matches against text this module already knows the
 * shape of — not a guess. Any sentence matching neither (e.g. the
 * "closely matched" fallback, or confidence/trust-score text if ever
 * concatenated in) is returned unlinked rather than mismatched.
 *
 * `fragments.map(f => f.text).join(" ")` always reconstructs the original
 * `explanation` string exactly — see explanationLinks.test.ts.
 */
export function splitExplanationFragments(result: PredictionResult): ExplanationFragment[] {
  const sentences = result.explanation.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 0);

  const topFactor = result.keyFactors[0] ?? null;
  const decisiveKey: DnaDimensionKey = result.matchDna.decisiveTrait;
  const decisiveDimension =
    result.teamDna[0].dimensions.find((dimension) => dimension.key === decisiveKey) ??
    result.teamDna[1].dimensions.find((dimension) => dimension.key === decisiveKey) ??
    null;

  return sentences.map((sentence) => {
    if (topFactor && sentence.toLowerCase().includes(topFactor.label.toLowerCase())) {
      return { text: sentence, linkedDimensionKey: topFactor.id as DnaDimensionKey };
    }
    if (decisiveDimension && sentence.includes(decisiveDimension.label)) {
      return { text: sentence, linkedDimensionKey: decisiveDimension.key };
    }
    return { text: sentence, linkedDimensionKey: null };
  });
}
