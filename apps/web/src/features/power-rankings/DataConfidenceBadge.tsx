import { Badge } from "@repo/ui";
import type { DataConfidence } from "./rankingTypes";

export interface DataConfidenceBadgeProps {
  confidence: DataConfidence;
  /** When provided, shown as a tooltip-free inline hint (e.g. "3 matches") — omitted entirely for `"unrated"`, which by definition has none. */
  seriesCountInWindow?: number;
}

const CONFIDENCE_LABEL: Record<DataConfidence, string> = {
  verified: "Verified data",
  provisional: "Provisional data",
  unrated: "Unrated (no match data)",
};

const CONFIDENCE_TONE: Record<DataConfidence, "success" | "info" | "neutralStatus"> = {
  verified: "success",
  provisional: "info",
  unrated: "neutralStatus",
};

/**
 * Distinct from `RankMovementBadge` (rank-change history) — this badge is
 * about how much to trust the *current* score itself: whether the team's
 * identity mapping is verified and whether it has enough canonical-window
 * match history (`rankingModel.ts`'s `computeDataConfidence`). Absent
 * entirely from the synthetic-scenario path, which has no confidence
 * concept of its own.
 */
export function DataConfidenceBadge({ confidence, seriesCountInWindow }: DataConfidenceBadgeProps) {
  const label =
    confidence !== "unrated" && typeof seriesCountInWindow === "number"
      ? `${CONFIDENCE_LABEL[confidence]} · ${seriesCountInWindow} match${seriesCountInWindow === 1 ? "" : "es"}`
      : CONFIDENCE_LABEL[confidence];

  return <Badge tone={CONFIDENCE_TONE[confidence]}>{label}</Badge>;
}
