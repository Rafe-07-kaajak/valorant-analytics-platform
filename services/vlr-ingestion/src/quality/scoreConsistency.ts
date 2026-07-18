import { isValidSeriesWinCount } from "../normalize/seriesFormat";
import type { NormalizedMatch } from "../normalize/normalizedSchemas";
import { createQualityIssue } from "./qualityIssue";
import type { QualityIssue } from "./qualityIssue";

/**
 * Score and winner consistency — TASK-043 requirement 12. Defense-in-depth
 * over what `normalize/normalizeMatch.ts`/`normalize/scoreValidation.ts`
 * (TASK-041/042, unchanged) already compute at normalization time: this
 * module re-derives the same invariants directly from a *persisted*
 * `NormalizedMatch` record, so a corrupted or hand-edited file is caught by
 * the audit even if it slipped past normalization. Never fabricates a
 * correction — every violation is reported, never repaired in place.
 */
export function auditMatchScoreConsistency(match: NormalizedMatch, detectedAt: string): readonly QualityIssue[] {
  const issues: QualityIssue[] = [];
  const sourceReference = match.sourceReference.sourceUrl;

  if (match.status !== "completed") return issues; // scheduled/live/postponed/cancelled matches have no series result to validate yet.

  if (match.winnerId !== null && match.winnerId !== match.teamAId && match.winnerId !== match.teamBId) {
    issues.push(
      createQualityIssue({
        code: "inconsistent_series_winner",
        entityType: "match",
        entityId: match.internalId,
        field: "winnerId",
        message: `Winner "${match.winnerId}" does not match either competing team ("${match.teamAId}" / "${match.teamBId}").`,
        sourceReference,
        detectedAt,
      }),
    );
  }

  const playedMaps = match.maps.filter((map) => map.teamAScore !== null && map.teamBScore !== null);

  for (const map of playedMaps) {
    if ((map.teamAScore ?? 0) < 0 || (map.teamBScore ?? 0) < 0) {
      issues.push(
        createQualityIssue({
          code: "invalid_score",
          entityType: "match",
          entityId: match.internalId,
          field: `maps[${map.order}]`,
          message: `Map "${map.map.name}" (order ${map.order}) has a negative score.`,
          sourceReference,
          detectedAt,
        }),
      );
    }

    if (map.teamAScore === map.teamBScore && map.winnerInternalTeamId) {
      issues.push(
        createQualityIssue({
          code: "inconsistent_map_winner",
          entityType: "match",
          entityId: match.internalId,
          field: `maps[${map.order}]`,
          message: `Map "${map.map.name}" (order ${map.order}) is tied ${map.teamAScore}-${map.teamBScore} but a winner is recorded.`,
          sourceReference,
          detectedAt,
        }),
      );
    }

    if (map.winnerInternalTeamId && map.teamAScore !== map.teamBScore) {
      const scoreWinner = (map.teamAScore ?? 0) > (map.teamBScore ?? 0) ? match.teamAId : match.teamBId;
      if (map.winnerInternalTeamId !== scoreWinner) {
        issues.push(
          createQualityIssue({
            code: "inconsistent_map_winner",
            entityType: "match",
            entityId: match.internalId,
            field: `maps[${map.order}]`,
            message: `Map "${map.map.name}" (order ${map.order}) records "${map.winnerInternalTeamId}" as winner, but the score ${map.teamAScore}-${map.teamBScore} favors "${scoreWinner}".`,
            sourceReference,
            detectedAt,
          }),
        );
      }
    }

    if (map.teamAAttackScore !== undefined && map.teamADefenseScore !== undefined && map.teamAScore !== undefined) {
      const roundsPlayed = (map.teamAAttackScore ?? 0) + (map.teamADefenseScore ?? 0);
      // Requirement 12 only bounds the split ("do not exceed total rounds"),
      // never requires exact equality: a map's attack+defense win split can
      // legitimately fall short of the total score (VLR's real markup does
      // not extend the attack/defense breakdown into overtime rounds, so an
      // OT map's split is expected to under-count) — only a split that
      // claims *more* wins than the recorded total score is structurally
      // impossible.
      if (map.teamAScore !== null && roundsPlayed > map.teamAScore) {
        issues.push(
          createQualityIssue({
            code: "invalid_score",
            entityType: "match",
            entityId: match.internalId,
            field: `maps[${map.order}].teamAAttackDefenseSplit`,
            message: `Map "${map.map.name}" (order ${map.order}): team A's attack+defense split (${roundsPlayed}) exceeds its total score (${map.teamAScore}), which is impossible.`,
            sourceReference,
            detectedAt,
          }),
        );
      }
    }
  }

  const teamAMapWins = playedMaps.filter((m) => m.winnerInternalTeamId === match.teamAId).length;
  const teamBMapWins = playedMaps.filter((m) => m.winnerInternalTeamId === match.teamBId).length;
  const winnerMapWins = match.winnerId === match.teamAId ? teamAMapWins : match.winnerId === match.teamBId ? teamBMapWins : 0;

  if (match.winnerId && !isValidSeriesWinCount(match.seriesFormat, winnerMapWins)) {
    issues.push(
      createQualityIssue({
        code: match.status === "completed" && playedMaps.length > 0 ? "forfeit" : "inconsistent_series_winner",
        entityType: "match",
        entityId: match.internalId,
        field: "seriesFormat",
        message: `Winner "${match.winnerId}" won ${winnerMapWins} map(s), which is not a valid winning count for series format "${match.seriesFormat}" — recorded as-is, excluded from training by default.`,
        sourceReference,
        detectedAt,
      }),
    );
  }

  return issues;
}
