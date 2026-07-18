import { loadVlrIngestionConfig } from "../env";
import { IngestionError } from "../errors";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { loadNormalizedDataset } from "../discovery/loadNormalizedDataset";
import { buildCanonicalTargetScope } from "../scope/backfillScope";
import { QUALITY_REPORT_KEY, runQualityAudit, saveQualityReport } from "../quality/qualityAudit";
import { summarizeQualityIssues } from "../quality/qualityIssue";
import { runCli } from "./cliSupport";

/**
 * `pnpm ingest:vlr:quality:audit` — TASK-043 requirement 15. Runs every
 * roster/score/map/timestamp/duplicate check across all persisted matches,
 * persists the resulting issue ledger (`discovery/quality-report.json`, via
 * the existing `DiscoveryIndexStore` mechanism — no new store surface
 * needed), and prints a severity-bucketed summary. No network.
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const asJson = process.argv.includes("--json");
  const store = new FilesystemIngestionStore(config.dataDir);
  const dataset = await loadNormalizedDataset(store);
  if (dataset.matches.length === 0) {
    throw new IngestionError("checkpoint_failure", "No normalized matches found. Run `pnpm ingest:vlr:backfill` first.");
  }

  const scope = buildCanonicalTargetScope();
  const detectedAt = new Date().toISOString();
  const freshResult = runQualityAudit(dataset.matches, dataset.eventsById, scope.startDate, scope.endDate, detectedAt);
  const result = await saveQualityReport(store, freshResult);

  const summary = summarizeQualityIssues(result.issues);

  if (asJson) {
    console.log(JSON.stringify({ summary, ...result }, null, 2));
    return;
  }

  console.log(`Data directory: ${config.dataDir}`);
  console.log("");
  console.log("=== Quality issue ledger ===");
  console.log(`Total issues: ${summary.totalIssues} (open: ${summary.openCount}, resolved: ${summary.resolvedCount})`);
  console.log(`By severity: ${JSON.stringify(summary.bySeverity)}`);
  console.log(`By code: ${JSON.stringify(summary.byCode)}`);
  console.log("");
  console.log("=== Match audit ===");
  console.log(JSON.stringify(result.matchAudit, null, 2));
  console.log("");
  console.log(`Semantic duplicate candidates: ${result.duplicateCandidates.filter((c) => c.classification !== "rematch-not-duplicate").length} (of ${result.duplicateCandidates.length} team-pair comparisons)`);
  console.log("");
  console.log(`Persisted to: discovery/${QUALITY_REPORT_KEY}.json. Next step: pnpm ingest:vlr:quality:reconcile`);
}

void runCli(main);
