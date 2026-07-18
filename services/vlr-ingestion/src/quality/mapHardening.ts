import type { NormalizedMatch } from "../normalize/normalizedSchemas";
import { createQualityIssue } from "./qualityIssue";
import type { QualityIssue } from "./qualityIssue";

/**
 * Map identity hardening — TASK-043 requirement 13. Builds on
 * `normalize/mapNormalization.ts` (unchanged: known-map alias table,
 * "unknown" is preserved verbatim, never remapped to the nearest known
 * map). This module adds the placeholder distinction requirement 13 asks
 * for: an explicit "not a real played map" token (`"N/A"`, `"TBD"`, empty)
 * must never be counted as an unknown *real* map — it is its own category,
 * `unplayed_map_placeholder`.
 */
const UNPLAYED_PLACEHOLDER_TOKENS: ReadonlySet<string> = new Set(["n/a", "na", "tbd", "unplayed", "decider", ""]);

export function isUnplayedMapPlaceholder(rawMapName: string): boolean {
  return UNPLAYED_PLACEHOLDER_TOKENS.has(rawMapName.trim().toLowerCase());
}

export function auditMatchMaps(match: NormalizedMatch, detectedAt: string): readonly QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const map of match.maps) {
    if (isUnplayedMapPlaceholder(map.map.raw)) {
      issues.push(
        createQualityIssue({
          code: "unplayed_map_placeholder",
          entityType: "match",
          entityId: match.internalId,
          field: `maps[${map.order}]`,
          message: `Map slot at order ${map.order} carries a placeholder name ("${map.map.raw}") rather than a real map — treated as unplayed, never as a real map.`,
          sourceReference: match.sourceReference.sourceUrl,
          severity: "info",
          detectedAt,
        }),
      );
      continue;
    }

    if (!map.map.recognized) {
      issues.push(
        createQualityIssue({
          code: "unknown_map",
          entityType: "match",
          entityId: match.internalId,
          field: `maps[${map.order}]`,
          message: `Map "${map.map.raw}" (order ${map.order}) is not in the known competitive map pool — preserved verbatim, never remapped to the closest known map.`,
          sourceReference: match.sourceReference.sourceUrl,
          detectedAt,
        }),
      );
    }
    // A real (recognized or unknown) map name with null scores is already
    // covered by the existing `missing_map_score` QualityFlag at
    // normalization time — no separate TASK-043 issue duplicates that here.
  }

  return issues;
}
