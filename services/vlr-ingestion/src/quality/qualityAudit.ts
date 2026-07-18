import type { NormalizedEvent, NormalizedMatch } from "../normalize/normalizedSchemas";
import type { IngestionStore } from "../persistence/types";
import { auditMatchRosters } from "./rosterQuality";
import { auditMatchMaps } from "./mapHardening";
import { auditMatchScoreConsistency } from "./scoreConsistency";
import { auditMatchTimestamp } from "./timestampHardening";
import { detectDuplicateMatchCandidates } from "./duplicateDetection";
import type { DuplicateMatchCandidate } from "./duplicateDetection";
import { createQualityIssue, mergeQualityIssues, sortQualityIssues } from "./qualityIssue";
import type { QualityIssue } from "./qualityIssue";

/** Persisted via the existing `DiscoveryIndexStore` mechanism (`discovery/quality-report.json`) — shared by `cli/qualityAudit.ts` (writer) and `cli/curate.ts` (reader), so two `curate` runs against unchanged data reuse the exact same issue timestamps rather than each minting a fresh `detectedAt`. */
export const QUALITY_REPORT_KEY = "quality-report";

export async function loadQualityReport(store: IngestionStore): Promise<QualityAuditResult | null> {
  return store.getDiscoverySummary<QualityAuditResult>(QUALITY_REPORT_KEY);
}

/** Persists a freshly-computed audit, preserving each issue's original `firstDetectedAt` across runs when a previous report already exists (via `mergeQualityIssues`) — so `firstDetectedAt` reflects when an issue was truly first seen, not merely "the last time this command ran". */
export async function saveQualityReport(store: IngestionStore, result: QualityAuditResult): Promise<QualityAuditResult> {
  const previous = await loadQualityReport(store);
  const merged: QualityAuditResult = previous ? { ...result, issues: sortQualityIssues(mergeQualityIssues(previous.issues, result.issues)) } : result;
  await store.recordDiscoverySummary(QUALITY_REPORT_KEY, merged);
  return merged;
}

/**
 * Full match-facing quality audit — TASK-043 requirements 8/11/12/13/14/15.
 * Combines every per-match audit into one deterministic `QualityIssue`
 * ledger, plus semantic-duplicate diagnostics. Read-only over already-
 * persisted normalized records; never mutates or deletes anything.
 */
export interface MatchAuditSummary {
  readonly totalMatches: number;
  readonly missingWinnerCount: number;
  readonly missingTeamsCount: number;
  readonly zeroPlayedMapsCount: number;
  readonly unknownMapCount: number;
  readonly forfeitCount: number;
  readonly incompleteRosterCount: number;
  readonly ambiguousTimestampCount: number;
}

export interface QualityAuditResult {
  readonly issues: readonly QualityIssue[];
  readonly duplicateCandidates: readonly DuplicateMatchCandidate[];
  readonly matchAudit: MatchAuditSummary;
}

export function runQualityAudit(matches: readonly NormalizedMatch[], eventsById: ReadonlyMap<string, NormalizedEvent>, scopeStartDate: string, scopeEndDate: string, detectedAt: string): QualityAuditResult {
  const issues: QualityIssue[] = [];

  let missingWinnerCount = 0;
  let missingTeamsCount = 0;
  let zeroPlayedMapsCount = 0;
  let unknownMapCount = 0;
  let forfeitCount = 0;
  let incompleteRosterCount = 0;
  let ambiguousTimestampCount = 0;

  for (const match of matches) {
    issues.push(...auditMatchRosters(match, detectedAt));
    issues.push(...auditMatchMaps(match, detectedAt));
    issues.push(...auditMatchScoreConsistency(match, detectedAt));
    issues.push(...auditMatchTimestamp(match, eventsById.get(match.eventId) ?? null, scopeStartDate, scopeEndDate, detectedAt));

    if (match.status === "completed" && !match.winnerId) missingWinnerCount += 1;
    if (!match.teamAId || !match.teamBId) missingTeamsCount += 1;
    if (match.status === "completed" && match.maps.every((m) => m.teamAScore === null && m.teamBScore === null)) zeroPlayedMapsCount += 1;
    if (match.maps.some((m) => !m.map.recognized)) unknownMapCount += 1;
    if (match.status === "completed" && match.trainingEligibility.reasons.includes("invalid_series_result")) forfeitCount += 1;
    if (!match.rosterSnapshots || match.rosterSnapshots.length < 2 || match.rosterSnapshots.some((r) => r.playerInternalIds.length < 5)) incompleteRosterCount += 1;
    if (match.scheduledAt.confidence === "none") ambiguousTimestampCount += 1;
  }

  const duplicateCandidates = detectDuplicateMatchCandidates(matches);
  for (const candidate of duplicateCandidates) {
    if (candidate.classification === "rematch-not-duplicate") continue;
    issues.push(
      createQualityIssue({
        code: "semantic_duplicate_candidate",
        entityType: "match",
        entityId: candidate.matchA,
        field: candidate.matchB,
        message: `Match "${candidate.matchA}" and "${candidate.matchB}" are ${candidate.classification} (confidence: ${candidate.confidence}) — ${candidate.evidence.join(" ")}`,
        severity: candidate.confidence === "high" ? "warning" : "info",
        detectedAt,
      }),
    );
  }

  return {
    issues: sortQualityIssues(issues),
    duplicateCandidates,
    matchAudit: { totalMatches: matches.length, missingWinnerCount, missingTeamsCount, zeroPlayedMapsCount, unknownMapCount, forfeitCount, incompleteRosterCount, ambiguousTimestampCount },
  };
}
