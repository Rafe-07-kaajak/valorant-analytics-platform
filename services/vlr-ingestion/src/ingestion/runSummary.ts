/**
 * Ingestion run summary — see docs/29-vlr-data-ingestion-foundation.md
 * ("Ingestion Orchestration") and TASK-041 requirement 22.
 */
export interface RunFailure {
  readonly stage: "discover-events" | "discover-matches" | "fetch-match" | "normalize" | "persist";
  readonly externalId: string;
  readonly message: string;
}

export interface RunSummary {
  readonly scopeStartDate: string;
  readonly scopeEndDate: string;
  readonly dryRun: boolean;
  readonly discoveredEvents: number;
  readonly includedEvents: number;
  readonly excludedEventsByReason: Record<string, number>;
  readonly unknownEvents: number;
  readonly discoveredMatchLinks: number;
  readonly duplicateMatchLinks: number;
  readonly fetchedMatches: number;
  readonly skippedUnchangedMatches: number;
  readonly completedMatches: number;
  readonly nonCompletedMatches: number;
  readonly parsedRecords: number;
  readonly normalizedRecords: number;
  readonly insertedRecords: number;
  readonly updatedRecords: number;
  readonly unchangedRecords: number;
  readonly trainingEligibleMatches: number;
  readonly ineligibleMatchesByReason: Record<string, number>;
  readonly warnings: number;
  readonly failures: readonly RunFailure[];
  readonly unmappedTeams: readonly string[];
  readonly durationMs: number;
  readonly checkpointStatus: "not-applicable" | "saved" | "skipped-dry-run" | "skipped-due-to-failure";
}

export class RunSummaryBuilder {
  private readonly startedAt = Date.now();
  private readonly excludedEventsByReason: Record<string, number> = {};
  private readonly ineligibleMatchesByReason: Record<string, number> = {};
  private readonly failures: RunFailure[] = [];
  private readonly unmappedTeams = new Set<string>();

  discoveredEvents = 0;
  includedEvents = 0;
  unknownEvents = 0;
  discoveredMatchLinks = 0;
  duplicateMatchLinks = 0;
  fetchedMatches = 0;
  skippedUnchangedMatches = 0;
  completedMatches = 0;
  nonCompletedMatches = 0;
  parsedRecords = 0;
  normalizedRecords = 0;
  insertedRecords = 0;
  updatedRecords = 0;
  unchangedRecords = 0;
  trainingEligibleMatches = 0;
  warnings = 0;

  recordExcludedEvent(reason: string): void {
    this.excludedEventsByReason[reason] = (this.excludedEventsByReason[reason] ?? 0) + 1;
  }

  recordIneligibleMatch(reasons: readonly string[]): void {
    for (const reason of reasons) this.ineligibleMatchesByReason[reason] = (this.ineligibleMatchesByReason[reason] ?? 0) + 1;
  }

  recordFailure(failure: RunFailure): void {
    this.failures.push(failure);
  }

  recordUnmappedTeam(internalId: string): void {
    this.unmappedTeams.add(internalId);
  }

  build(scope: { startDate: string; endDate: string }, dryRun: boolean, checkpointStatus: RunSummary["checkpointStatus"]): RunSummary {
    return {
      scopeStartDate: scope.startDate,
      scopeEndDate: scope.endDate,
      dryRun,
      discoveredEvents: this.discoveredEvents,
      includedEvents: this.includedEvents,
      excludedEventsByReason: this.excludedEventsByReason,
      unknownEvents: this.unknownEvents,
      discoveredMatchLinks: this.discoveredMatchLinks,
      duplicateMatchLinks: this.duplicateMatchLinks,
      fetchedMatches: this.fetchedMatches,
      skippedUnchangedMatches: this.skippedUnchangedMatches,
      completedMatches: this.completedMatches,
      nonCompletedMatches: this.nonCompletedMatches,
      parsedRecords: this.parsedRecords,
      normalizedRecords: this.normalizedRecords,
      insertedRecords: this.insertedRecords,
      updatedRecords: this.updatedRecords,
      unchangedRecords: this.unchangedRecords,
      trainingEligibleMatches: this.trainingEligibleMatches,
      ineligibleMatchesByReason: this.ineligibleMatchesByReason,
      warnings: this.warnings,
      failures: this.failures,
      unmappedTeams: [...this.unmappedTeams].sort(),
      durationMs: Date.now() - this.startedAt,
      checkpointStatus,
    };
  }
}
