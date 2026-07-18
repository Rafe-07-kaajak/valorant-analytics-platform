import { deterministicInternalId } from "../identity/deterministicId";
import type { NormalizedMatch } from "../normalize/normalizedSchemas";
import type { IngestionStore } from "../persistence/types";
import type { EventDiscoveryManifest } from "./eventManifest";
import type { MatchDiscoveryManifest } from "./matchManifest";

/**
 * Post-backfill data-quality report — TASK-042 requirement 14. Every count
 * is reported alongside its percentage of the normalized total, never raw
 * counts alone.
 */
export interface QualityReport {
  readonly totalDiscoveredEvents: number;
  readonly totalIncludedEvents: number;
  readonly totalExcludedEvents: number;
  readonly totalDiscoveredMatchIds: number;
  readonly totalFetchedDetails: number;
  readonly totalNormalizedMatches: number;
  readonly trainingEligibleMatches: number;
  readonly ineligibleMatches: number;
  readonly duplicateMatchLinks: number;
  readonly parseFailures: number;
  readonly networkFailures: number;
  readonly missingTeamMappings: number;
  readonly unknownEventClassifications: number;
  readonly ambiguousTimestamps: number;
  readonly missingSeriesFormat: number;
  readonly missingWinner: number;
  readonly missingMaps: number;
  readonly unknownMaps: number;
  readonly incompleteRosters: number;
  readonly forfeits: number;
  readonly recordsByYear: Record<string, number>;
  readonly recordsByEventFamily: Record<string, number>;
  readonly recordsBySeriesFormat: Record<string, number>;
  readonly recordsByMap: Record<string, number>;
  readonly recordsByTeam: Record<string, number>;
  readonly percentTrainingEligible: number;
}

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export async function buildQualityReport(store: IngestionStore, eventManifest: EventDiscoveryManifest, matchManifest: MatchDiscoveryManifest): Promise<QualityReport> {
  const includedEvents = eventManifest.entries.filter((e) => e.inclusionStatus === "included").length;
  const excludedEvents = eventManifest.entries.filter((e) => e.inclusionStatus === "excluded").length;

  const failures = await store.listFailures();
  const networkFailures = failures.filter((f) => ["timeout", "rate_limited", "unexpected_status", "fetch_failed"].includes(f.errorCode)).length;
  const parseFailures = failures.filter((f) => f.errorCode === "parse_failure" || f.errorCode === "critical_field_missing").length;

  let totalNormalizedMatches = 0;
  let trainingEligibleMatches = 0;
  let missingTeamMappings = 0;
  let ambiguousTimestamps = 0;
  let missingSeriesFormat = 0;
  let missingWinner = 0;
  let missingMaps = 0;
  let unknownMaps = 0;
  let incompleteRosters = 0;
  let forfeits = 0;
  const recordsByYear: Record<string, number> = {};
  const recordsByEventFamily: Record<string, number> = {};
  const recordsBySeriesFormat: Record<string, number> = {};
  const recordsByMap: Record<string, number> = {};
  const recordsByTeam: Record<string, number> = {};

  // `listUnmappedTeams()` is populated only when a "team" entity is
  // normalized and persisted — the backfill pipeline never does that (it
  // only persists events and matches), so that index stays empty here.
  // `deterministicInternalId` is the reliable signal instead: an unmapped
  // team's internal ID is always literally "vlr:team:<id>" (see
  // `identity/teamMapping.ts`'s `resolveTeamIdentity`), while a mapped
  // team's internal ID is a clean `VctTeamId` slug with no such prefix.
  const isUnmappedTeamId = (teamId: string): boolean => teamId.startsWith("vlr:team:");

  for (const entry of matchManifest.entries) {
    const record = await store.getNormalizedEntity<NormalizedMatch>("match", deterministicInternalId("match", entry.vlrMatchId));
    if (!record) continue;
    totalNormalizedMatches += 1;
    if (record.trainingEligibility.eligible) trainingEligibleMatches += 1;

    if (record.qualityFlags.some((f) => f.code === "missing_team_mapping")) missingTeamMappings += 1;
    if (record.scheduledAt.confidence === "none") ambiguousTimestamps += 1;
    if (record.qualityFlags.some((f) => f.code === "missing_series_format")) missingSeriesFormat += 1;
    if (record.status === "completed" && !record.winnerId) missingWinner += 1;
    if (record.maps.length === 0) missingMaps += 1;
    if (record.maps.some((m) => !m.map.recognized)) unknownMaps += 1;
    if (record.qualityFlags.some((f) => f.code === "incomplete_roster")) incompleteRosters += 1;
    // A forfeit surfaces as a completed match with an internally
    // inconsistent map-win count for its series format (see
    // scoreValidation.ts / trainingEligibility.ts's "invalid_series_result")
    // — recorded, flagged, and excluded from training by default per
    // TASK-042 requirement 13, never silently converted to a normal result.
    if (record.status === "completed" && record.trainingEligibility.reasons.includes("invalid_series_result")) forfeits += 1;

    if (record.scheduledAt.iso) increment(recordsByYear, record.scheduledAt.iso.slice(0, 4));
    increment(recordsByEventFamily, entry.eventFamily);
    increment(recordsBySeriesFormat, record.seriesFormat);
    for (const map of record.maps) increment(recordsByMap, map.map.name);
    if (!isUnmappedTeamId(record.teamAId)) increment(recordsByTeam, record.teamAId);
    if (!isUnmappedTeamId(record.teamBId)) increment(recordsByTeam, record.teamBId);
  }

  const unknownEventClassifications = eventManifest.entries.filter((e) => e.inclusionStatus === "unknown").length;

  return {
    totalDiscoveredEvents: eventManifest.entries.length,
    totalIncludedEvents: includedEvents,
    totalExcludedEvents: excludedEvents,
    totalDiscoveredMatchIds: matchManifest.entries.length,
    totalFetchedDetails: totalNormalizedMatches + failures.filter((f) => f.entityType === "match" && f.operation === "fetch-match").length,
    totalNormalizedMatches,
    trainingEligibleMatches,
    ineligibleMatches: totalNormalizedMatches - trainingEligibleMatches,
    duplicateMatchLinks: matchManifest.duplicateMatchLinks,
    parseFailures,
    networkFailures,
    missingTeamMappings,
    unknownEventClassifications,
    ambiguousTimestamps,
    missingSeriesFormat,
    missingWinner,
    missingMaps,
    unknownMaps,
    incompleteRosters,
    forfeits,
    recordsByYear,
    recordsByEventFamily,
    recordsBySeriesFormat,
    recordsByMap,
    recordsByTeam,
    percentTrainingEligible: totalNormalizedMatches > 0 ? Math.round((trainingEligibleMatches / totalNormalizedMatches) * 1000) / 10 : 0,
  };
}

export function formatQualityReport(report: QualityReport): string {
  const pct = (n: number) => (report.totalNormalizedMatches > 0 ? `${Math.round((n / report.totalNormalizedMatches) * 1000) / 10}%` : "n/a");
  return [
    `Events: ${report.totalDiscoveredEvents} discovered, ${report.totalIncludedEvents} included, ${report.totalExcludedEvents} excluded`,
    `Matches: ${report.totalDiscoveredMatchIds} discovered links, ${report.totalNormalizedMatches} normalized, ${report.duplicateMatchLinks} duplicates`,
    `Training-eligible: ${report.trainingEligibleMatches} (${report.percentTrainingEligible}%), ineligible: ${report.ineligibleMatches}`,
    `Failures: ${report.networkFailures} network, ${report.parseFailures} parse`,
    `Missing team mappings: ${report.missingTeamMappings} (${pct(report.missingTeamMappings)})`,
    `Unknown event classifications: ${report.unknownEventClassifications}`,
    `Ambiguous timestamps: ${report.ambiguousTimestamps} (${pct(report.ambiguousTimestamps)})`,
    `Missing series format: ${report.missingSeriesFormat} (${pct(report.missingSeriesFormat)})`,
    `Missing winner: ${report.missingWinner} (${pct(report.missingWinner)})`,
    `Missing maps: ${report.missingMaps} (${pct(report.missingMaps)})`,
    `Unknown maps: ${report.unknownMaps} (${pct(report.unknownMaps)})`,
    `Incomplete rosters: ${report.incompleteRosters} (${pct(report.incompleteRosters)})`,
    `Forfeits: ${report.forfeits} (${pct(report.forfeits)})`,
    `By year: ${JSON.stringify(report.recordsByYear)}`,
    `By event family: ${JSON.stringify(report.recordsByEventFamily)}`,
    `By series format: ${JSON.stringify(report.recordsBySeriesFormat)}`,
    `By map: ${JSON.stringify(report.recordsByMap)}`,
  ].join("\n");
}
