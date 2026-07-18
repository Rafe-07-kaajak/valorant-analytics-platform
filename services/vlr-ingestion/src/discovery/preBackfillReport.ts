import { APPROVED_EVENT_FAMILIES } from "../classification/eventFamily";
import type { ApprovedEventFamily } from "../classification/eventFamily";
import type { VlrIngestionConfig } from "../env";
import type { EventDiscoveryManifest } from "./eventManifest";
import type { MatchDiscoveryManifest } from "./matchManifest";

/**
 * Pre-backfill discovery report — TASK-042 requirement 7. Printed and
 * persisted before any match-detail fetching begins, with anomaly checks a
 * human should review before committing to a full historical backfill.
 */
export interface PreBackfillReport {
  readonly scopeStartDate: string;
  readonly scopeEndDate: string;
  readonly eventPagesScannedNote: string;
  readonly candidateEvents: number;
  readonly includedEventsByFamily: Record<ApprovedEventFamily, number>;
  readonly excludedEventsByReason: Record<string, number>;
  readonly unknownEvents: number;
  readonly matchLinksDiscovered: number;
  readonly duplicateMatchLinks: number;
  readonly completedMatches: number;
  readonly nonCompletedMatches: number;
  readonly matchesRequiringStatusResolution: number;
  readonly expectedDetailRequests: number;
  readonly estimatedMinimumRuntimeMs: number;
  readonly anomalies: readonly string[];
}

export function buildPreBackfillReport(eventManifest: EventDiscoveryManifest, matchManifest: MatchDiscoveryManifest, config: VlrIngestionConfig): PreBackfillReport {
  const includedEventsByFamily = Object.fromEntries(APPROVED_EVENT_FAMILIES.map((family) => [family, 0])) as Record<ApprovedEventFamily, number>;
  const excludedEventsByReason: Record<string, number> = {};
  let unknownEvents = 0;

  for (const entry of eventManifest.entries) {
    if (entry.inclusionStatus === "included") {
      includedEventsByFamily[entry.classification as ApprovedEventFamily] += 1;
    } else if (entry.inclusionStatus === "excluded") {
      const reason = entry.exclusionReason ?? entry.classification;
      excludedEventsByReason[reason] = (excludedEventsByReason[reason] ?? 0) + 1;
    } else {
      unknownEvents += 1;
    }
  }

  const completedMatches = matchManifest.entries.filter((m) => m.listedStatus === "completed").length;
  const nonCompletedMatches = matchManifest.entries.length - completedMatches;
  // A non-completed listing can still resolve to completed on detail fetch
  // (VLR's listing status can lag reality by minutes) — see requirement 6
  // ("exclude non-completed matches from detail backfill unless detail
  // fetch is required to resolve status"). Live/upcoming matches close to
  // the scope boundary are the ones worth a resolving fetch; this report
  // counts every non-completed listing as a candidate for that, which the
  // backfill runner may choose not to fetch.
  const matchesRequiringStatusResolution = nonCompletedMatches;
  const expectedDetailRequests = completedMatches;
  const estimatedMinimumRuntimeMs = expectedDetailRequests * config.minRequestIntervalMs;

  const anomalies: string[] = [];
  for (const family of APPROVED_EVENT_FAMILIES) {
    if (includedEventsByFamily[family] === 0) anomalies.push(`Zero included events for approved family "${family}".`);
  }
  if (includedEventsByFamily.masters === 0) anomalies.push("Zero Masters events included — expected at least one within an 18-month scope.");
  if (includedEventsByFamily.champions === 0) anomalies.push("Zero Champions events included — expected at least one within an 18-month scope.");
  if (matchManifest.entries.length === 0) anomalies.push("Zero match links discovered across all included events.");
  if (matchManifest.entries.length > 0 && matchManifest.duplicateMatchLinks > matchManifest.entries.length) {
    anomalies.push(`Duplicate match links (${matchManifest.duplicateMatchLinks}) exceed unique match links (${matchManifest.entries.length}) — discovery may be double-counting.`);
  }
  if (unknownEvents > eventManifest.entries.length * 0.5 && eventManifest.entries.length > 0) {
    anomalies.push(`Unknown events (${unknownEvents}) exceed half of all candidate events (${eventManifest.entries.length}) — classification coverage may have regressed.`);
  }
  if (matchManifest.eventsWithFailedDiscovery.length > 0) {
    anomalies.push(`Match discovery failed outright for ${matchManifest.eventsWithFailedDiscovery.length} included event(s): ${matchManifest.eventsWithFailedDiscovery.join(", ")}.`);
  }
  for (const entry of eventManifest.entries) {
    if (entry.startDate && entry.startDate < `${eventManifest.scopeStartDate}T00:00:00.000Z`) {
      anomalies.push(`Event ${entry.vlrEventId} ("${entry.name}") starts before the approved scope start date.`);
    }
  }

  return {
    scopeStartDate: eventManifest.scopeStartDate,
    scopeEndDate: eventManifest.scopeEndDate,
    eventPagesScannedNote: "See discovery run logs for the exact page count scanned this run.",
    candidateEvents: eventManifest.entries.length,
    includedEventsByFamily,
    excludedEventsByReason,
    unknownEvents,
    matchLinksDiscovered: matchManifest.entries.length,
    duplicateMatchLinks: matchManifest.duplicateMatchLinks,
    completedMatches,
    nonCompletedMatches,
    matchesRequiringStatusResolution,
    expectedDetailRequests,
    estimatedMinimumRuntimeMs,
    anomalies,
  };
}

export function formatPreBackfillReport(report: PreBackfillReport): string {
  const lines = [
    `Discovery date range: ${report.scopeStartDate} through ${report.scopeEndDate}`,
    `Candidate events: ${report.candidateEvents}`,
    `Included events by family: ${JSON.stringify(report.includedEventsByFamily)}`,
    `Excluded events by reason: ${JSON.stringify(report.excludedEventsByReason)}`,
    `Unknown events: ${report.unknownEvents}`,
    `Match links discovered: ${report.matchLinksDiscovered} (duplicates: ${report.duplicateMatchLinks})`,
    `Completed matches: ${report.completedMatches}`,
    `Non-completed matches (require status resolution): ${report.nonCompletedMatches}`,
    `Expected detail requests: ${report.expectedDetailRequests}`,
    `Estimated minimum runtime at configured rate: ${Math.round(report.estimatedMinimumRuntimeMs / 1000 / 60)} minute(s)`,
    "",
    report.anomalies.length > 0 ? `ANOMALIES DETECTED (${report.anomalies.length}):` : "No anomalies detected.",
    ...report.anomalies.map((a) => `  - ${a}`),
  ];
  return lines.join("\n");
}
