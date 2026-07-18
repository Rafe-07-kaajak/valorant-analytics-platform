import { loadVlrIngestionConfig } from "../env";
import { IngestionError } from "../errors";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { EVENT_DISCOVERY_CHECKPOINT_KEY, loadEventDiscoveryManifest } from "../discovery/eventManifest";
import { loadMatchDiscoveryManifest } from "../discovery/matchManifest";
import { validateCompleteness } from "../discovery/completenessValidation";
import { runCli } from "./cliSupport";

/**
 * `pnpm ingest:vlr:validate` — TASK-042 requirement 15. Deterministic
 * completeness checks against the already-persisted store and manifests.
 * Exits non-zero when any hard-failure rule is violated.
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  console.log(`Data directory: ${config.dataDir}`);
  console.log("");

  const store = new FilesystemIngestionStore(config.dataDir);
  const eventManifest = await loadEventDiscoveryManifest(store);
  const matchManifest = await loadMatchDiscoveryManifest(store);
  if (!eventManifest || !matchManifest) {
    throw new IngestionError("checkpoint_failure", "No discovery manifests found. Run `pnpm ingest:vlr:discover` first.");
  }
  const discoveryCheckpoint = await store.readEventDiscoveryCheckpoint(EVENT_DISCOVERY_CHECKPOINT_KEY);

  const result = await validateCompleteness(store, eventManifest, matchManifest, discoveryCheckpoint);

  console.log(`Valid: ${result.valid}`);
  console.log(`Failures: ${result.failures.length}`);
  for (const failure of result.failures) console.log(`  FAIL: ${failure}`);
  console.log(`Warnings: ${result.warnings.length}`);
  for (const warning of result.warnings.slice(0, 20)) console.log(`  WARN: ${warning}`);
  if (result.warnings.length > 20) console.log(`  ... and ${result.warnings.length - 20} more warning(s).`);

  if (!result.valid) process.exitCode = 1;
}

void runCli(main);
