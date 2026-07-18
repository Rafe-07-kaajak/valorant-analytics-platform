import { loadVlrIngestionConfig } from "../env";
import { IngestionError } from "../errors";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { loadEventDiscoveryManifest } from "../discovery/eventManifest";
import { loadMatchDiscoveryManifest } from "../discovery/matchManifest";
import { runFullReconciliation } from "../reconciliation/runReconciliation";
import { countByCategory } from "../reconciliation/reconciliationTypes";
import { runCli } from "./cliSupport";

export const RECONCILIATION_REPORT_KEY = "reconciliation-report";

/**
 * `pnpm ingest:vlr:quality:reconcile [--dry-run]` — TASK-043 requirement
 * 10. Compares the current event/match discovery manifests against every
 * persisted normalized record. Writing the report (`discovery/
 * reconciliation-report.json`) is itself non-destructive — it only marks
 * categories, never deletes a file; pass `--dry-run` to skip even that
 * write and only print. Actual deletion is a separate, explicitly-flagged
 * command (`pnpm ingest:vlr:cleanup`), never run by default.
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const dryRun = process.argv.includes("--dry-run");
  const asJson = process.argv.includes("--json");
  const store = new FilesystemIngestionStore(config.dataDir);

  const eventManifest = await loadEventDiscoveryManifest(store);
  const matchManifest = await loadMatchDiscoveryManifest(store);
  if (!eventManifest || !matchManifest) {
    throw new IngestionError("checkpoint_failure", "No discovery manifests found. Run `pnpm ingest:vlr:discover` first.");
  }

  const { eventReport, matchReport } = await runFullReconciliation(store, eventManifest, matchManifest);
  const eventCounts = countByCategory(eventReport.entries);
  const matchCounts = countByCategory(matchReport.entries);

  if (!dryRun) {
    await store.recordDiscoverySummary(RECONCILIATION_REPORT_KEY, { eventReport, matchReport });
  }

  if (asJson) {
    console.log(JSON.stringify({ eventReport, matchReport, eventCounts, matchCounts, written: !dryRun }, null, 2));
    return;
  }

  console.log(`Data directory: ${config.dataDir}`);
  console.log(`Mode: ${dryRun ? "dry-run (report not persisted)" : "write (report persisted to discovery/" + RECONCILIATION_REPORT_KEY + ".json)"}`);
  console.log("");
  console.log("=== Event reconciliation ===");
  console.log(JSON.stringify(eventCounts, null, 2));
  for (const entry of eventReport.entries.filter((e) => e.category === "stale" || e.category === "out-of-scope" || e.category === "orphaned")) {
    console.log(`  ${entry.category.toUpperCase()}: ${entry.internalId} — ${entry.reason}`);
  }
  console.log("");
  console.log("=== Match reconciliation ===");
  console.log(JSON.stringify(matchCounts, null, 2));
  for (const entry of matchReport.entries.filter((e) => e.category === "stale" || e.category === "out-of-scope" || e.category === "orphaned")) {
    console.log(`  ${entry.category.toUpperCase()}: ${entry.internalId} — ${entry.reason}`);
  }

  if (eventCounts.stale === 0 && eventCounts["out-of-scope"] === 0 && eventCounts.orphaned === 0 && matchCounts.stale === 0 && matchCounts["out-of-scope"] === 0 && matchCounts.orphaned === 0) {
    console.log("");
    console.log("No stale, out-of-scope, or orphaned records found — the dataset is fully reconciled against the current manifests.");
  }
}

void runCli(main);
