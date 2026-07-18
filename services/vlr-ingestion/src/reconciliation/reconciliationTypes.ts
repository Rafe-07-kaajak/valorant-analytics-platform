/**
 * Shared reconciliation vocabulary — TASK-043 requirement 10. TASK-042
 * documented a real bug class this directly targets: a classification-rule
 * fix (or a `--restart-discovery`) can leave a normalized record on disk
 * whose current manifest entry no longer agrees it belongs — reconciliation
 * makes that mismatch explicit instead of leaving it silently accounted for
 * only by "the manifest looks right now."
 */
export type ReconciliationCategory = "current-approved" | "superseded" | "stale" | "out-of-scope" | "orphaned" | "audit-only-historical";

export interface ReconciliationEntry {
  readonly internalId: string;
  readonly providerExternalId: string;
  readonly category: ReconciliationCategory;
  readonly reason: string;
}

export interface ReconciliationReport {
  readonly entries: readonly ReconciliationEntry[];
  readonly generatedAt: string;
}

export function countByCategory(entries: readonly ReconciliationEntry[]): Record<ReconciliationCategory, number> {
  const counts: Record<ReconciliationCategory, number> = { "current-approved": 0, superseded: 0, stale: 0, "out-of-scope": 0, orphaned: 0, "audit-only-historical": 0 };
  for (const entry of entries) counts[entry.category] += 1;
  return counts;
}

/** Indexes a reconciliation report by provider external ID, for a downstream reconciliation pass (e.g. matches keyed by parent event ID) to look up. */
export function buildCategoryByExternalId(report: ReconciliationReport): ReadonlyMap<string, ReconciliationCategory> {
  return new Map(report.entries.map((entry) => [entry.providerExternalId, entry.category]));
}
