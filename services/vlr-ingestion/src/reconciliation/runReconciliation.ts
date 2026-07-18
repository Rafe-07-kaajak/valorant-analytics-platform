import type { EventDiscoveryManifest } from "../discovery/eventManifest";
import type { MatchDiscoveryManifest } from "../discovery/matchManifest";
import type { IngestionStore } from "../persistence/types";
import { reconcileEvents } from "./eventReconciliation";
import { reconcileMatches } from "./matchReconciliation";
import { buildCategoryByExternalId } from "./reconciliationTypes";
import type { ReconciliationReport } from "./reconciliationTypes";

export interface FullReconciliationResult {
  readonly eventReport: ReconciliationReport;
  readonly matchReport: ReconciliationReport;
}

/** Runs event reconciliation first, then feeds its per-event category into match reconciliation — a match is only ever "current-approved" if its parent event is too. */
export async function runFullReconciliation(store: IngestionStore, eventManifest: EventDiscoveryManifest, matchManifest: MatchDiscoveryManifest, now: () => Date = () => new Date()): Promise<FullReconciliationResult> {
  const eventReport = await reconcileEvents(store, eventManifest, now);
  const eventCategoryByVlrEventId = buildCategoryByExternalId(eventReport);
  const matchReport = await reconcileMatches(store, matchManifest, eventCategoryByVlrEventId, now);
  return { eventReport, matchReport };
}
