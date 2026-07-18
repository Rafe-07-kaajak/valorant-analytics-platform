import type { NormalizedMatch } from "../normalize/normalizedSchemas";
import type { IngestionStore } from "../persistence/types";
import type { ReconciliationCategory } from "../reconciliation/reconciliationTypes";
import type { QualityIssue } from "./qualityIssue";

/**
 * Quarantine policy — TASK-043 requirement 16. A quarantined record is
 * *never* deleted: it stays fully readable in the normalized store, but
 * `curate/curatedExport.ts` routes it to `quarantine.json` instead of
 * `matches.json`, and a quarantined match is never training-eligible
 * regardless of what its own `trainingEligibility` field says (that field
 * was computed at normalization time from record-local facts only, before
 * dataset-wide reconciliation existed).
 */
export interface QuarantineRecord {
  readonly entityType: "match";
  readonly internalId: string;
  readonly reasons: readonly string[];
  readonly firstQuarantinedAt: string;
  readonly sourceReference: string;
}

export interface QuarantineEvaluationInput {
  readonly match: NormalizedMatch;
  readonly reconciliationCategory: ReconciliationCategory | undefined;
  readonly issues: readonly QualityIssue[];
}

const FATAL_CODES: ReadonlySet<QualityIssue["code"]> = new Set(["inconsistent_series_winner", "invalid_score", "source_identity_missing", "team_mapping_conflict", "duplicate_match_id", "event_family_conflict"]);

export interface QuarantineEvaluation {
  readonly quarantined: boolean;
  readonly reasons: readonly string[];
}

export function evaluateQuarantine(input: QuarantineEvaluationInput): QuarantineEvaluation {
  const { match, reconciliationCategory, issues } = input;
  const reasons: string[] = [];

  if (!match.sourceReference.provider || !match.sourceReference.externalId) {
    reasons.push("source_identity_missing: match has no provider/external identity.");
  }
  if (!match.teamAId || !match.teamBId) {
    reasons.push("Both competing teams could not be identified.");
  }
  if (match.status === "completed" && match.winnerId && match.winnerId !== match.teamAId && match.winnerId !== match.teamBId) {
    reasons.push("inconsistent_series_winner: recorded winner does not match either competing team.");
  }
  const playedMaps = match.maps.filter((m) => m.teamAScore !== null && m.teamBScore !== null);
  if (match.status === "completed" && playedMaps.length === 0) {
    reasons.push("Completed match has zero played maps.");
  }
  if (reconciliationCategory === "stale" || reconciliationCategory === "out-of-scope" || reconciliationCategory === "orphaned") {
    reasons.push(`Reconciliation classified this record as "${reconciliationCategory}".`);
  }

  const fatalIssueCodes = issues.filter((issue) => issue.severity === "fatal" || FATAL_CODES.has(issue.code)).map((issue) => issue.code);
  for (const code of new Set(fatalIssueCodes)) reasons.push(`Fatal quality issue: ${code}.`);

  return { quarantined: reasons.length > 0, reasons };
}

export function buildQuarantineRecord(input: QuarantineEvaluationInput, evaluatedAt: string): QuarantineRecord | null {
  const evaluation = evaluateQuarantine(input);
  if (!evaluation.quarantined) return null;
  return {
    entityType: "match",
    internalId: input.match.internalId,
    reasons: evaluation.reasons,
    firstQuarantinedAt: evaluatedAt,
    sourceReference: input.match.sourceReference.sourceUrl,
  };
}

/** Persisted via the existing `DiscoveryIndexStore` mechanism (`discovery/quarantine-ledger.json`) — mirrors `quality/qualityAudit.ts`'s report persistence so `firstQuarantinedAt` stays stable across repeated `curate` runs instead of resetting to "now" every time. */
export const QUARANTINE_LEDGER_KEY = "quarantine-ledger";

export async function loadQuarantineLedger(store: IngestionStore): Promise<readonly QuarantineRecord[]> {
  return (await store.getDiscoverySummary<readonly QuarantineRecord[]>(QUARANTINE_LEDGER_KEY)) ?? [];
}

/** Preserves each record's original `firstQuarantinedAt` across runs when it was already quarantined for the same reason set previously. */
export async function saveQuarantineLedger(store: IngestionStore, records: readonly QuarantineRecord[]): Promise<readonly QuarantineRecord[]> {
  const previous = await loadQuarantineLedger(store);
  const previousByInternalId = new Map(previous.map((r) => [r.internalId, r]));
  const merged = records.map((record) => {
    const existing = previousByInternalId.get(record.internalId);
    return existing ? { ...record, firstQuarantinedAt: existing.firstQuarantinedAt } : record;
  });
  await store.recordDiscoverySummary(QUARANTINE_LEDGER_KEY, merged);
  return merged;
}
