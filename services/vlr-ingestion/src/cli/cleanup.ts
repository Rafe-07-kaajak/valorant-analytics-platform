import { loadVlrIngestionConfig } from "../env";
import { IngestionError } from "../errors";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { loadEventDiscoveryManifest } from "../discovery/eventManifest";
import { loadMatchDiscoveryManifest } from "../discovery/matchManifest";
import { runFullReconciliation } from "../reconciliation/runReconciliation";
import { runCli } from "./cliSupport";

/**
 * `pnpm ingest:vlr:cleanup [--delete]` — TASK-043 requirement 10. Defaults
 * to a dry run that only *prints* what stale/orphaned records would be
 * removed. Actual deletion requires the explicit `--delete` flag and is
 * never invoked by any other command in this package. Only "stale" and
 * "orphaned" records are ever eligible for deletion here — "out-of-scope"
 * records are excluded from curated exports but kept on disk, since a rules
 * change could legitimately bring them back into scope later.
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const shouldDelete = process.argv.includes("--delete");
  const store = new FilesystemIngestionStore(config.dataDir);

  const eventManifest = await loadEventDiscoveryManifest(store);
  const matchManifest = await loadMatchDiscoveryManifest(store);
  if (!eventManifest || !matchManifest) {
    throw new IngestionError("checkpoint_failure", "No discovery manifests found. Run `pnpm ingest:vlr:discover` first.");
  }

  const { eventReport, matchReport } = await runFullReconciliation(store, eventManifest, matchManifest);
  const deletableEvents = eventReport.entries.filter((e) => e.category === "stale" || e.category === "orphaned");
  const deletableMatches = matchReport.entries.filter((e) => e.category === "stale" || e.category === "orphaned");

  console.log(`Data directory: ${config.dataDir}`);
  console.log(`Mode: ${shouldDelete ? "DELETE (destructive)" : "dry-run (default — pass --delete to actually remove files)"}`);
  console.log("");
  console.log(`Eligible for deletion: ${deletableEvents.length} event record(s), ${deletableMatches.length} match record(s).`);
  for (const entry of deletableEvents) console.log(`  event ${entry.internalId} (${entry.category}): ${entry.reason}`);
  for (const entry of deletableMatches) console.log(`  match ${entry.internalId} (${entry.category}): ${entry.reason}`);

  if (!shouldDelete) {
    console.log("");
    console.log("Dry run only — no files were deleted. Re-run with --delete to actually remove them.");
    return;
  }

  for (const entry of deletableEvents) await store.deleteNormalizedEntity("event", entry.internalId);
  for (const entry of deletableMatches) await store.deleteNormalizedEntity("match", entry.internalId);
  console.log("");
  console.log(`Deleted ${deletableEvents.length} event record(s) and ${deletableMatches.length} match record(s).`);
}

void runCli(main);
