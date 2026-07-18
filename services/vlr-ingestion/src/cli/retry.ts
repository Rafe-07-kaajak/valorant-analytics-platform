import { describeConfig, loadVlrIngestionConfig } from "../env";
import { IngestionError } from "../errors";
import { buildCanonicalTargetScope } from "../scope/backfillScope";
import { buildTeamMappingLookup, INITIAL_TEAM_MAPPING_REGISTRY } from "../identity/teamMapping";
import { RealVlrProvider } from "../vlr/realVlrProvider";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { loadMatchDiscoveryManifest } from "../discovery/matchManifest";
import { runRetryBatch } from "../ingestion/backfillRunner";
import { runCli } from "./cliSupport";

const DEFAULT_BATCH_SIZE = 50;

/**
 * `pnpm ingest:vlr:retry` — TASK-042 requirement 16. Retries only matches
 * with an unresolved, retryable failure already in the ledger (see
 * `runRetryBatch`) — never a fresh match, never a non-retryable or
 * attempt-exhausted one. Does not loop indefinitely: one bounded batch per
 * invocation, same as `backfill`.
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  console.log("Rate/concurrency policy for this run:");
  console.log(describeConfig(config));
  console.log(`Data directory: ${config.dataDir}`);
  console.log("");

  if (!config.networkEnabled) {
    throw new IngestionError("network_disabled", "Set VLR_NETWORK_ENABLED=true to run a live retry batch.");
  }

  const store = new FilesystemIngestionStore(config.dataDir);
  const matchManifest = await loadMatchDiscoveryManifest(store);
  if (!matchManifest) {
    throw new IngestionError("checkpoint_failure", "No match discovery manifest found. Run `pnpm ingest:vlr:discover` first.");
  }

  const teamMapping = buildTeamMappingLookup(INITIAL_TEAM_MAPPING_REGISTRY);
  const scope = buildCanonicalTargetScope();
  const provider = new RealVlrProvider(config);

  const result = await runRetryBatch({ provider, store, teamMapping }, matchManifest, scope, DEFAULT_BATCH_SIZE, {
    onProgress: ({ vlrMatchId, processed, batchSize }) => console.log(`  [${processed}/${batchSize}] retrying match ${vlrMatchId}`),
  });

  console.log("");
  console.log("=== Retry batch complete ===");
  console.log(`Processed: ${result.processed}, Inserted: ${result.inserted}, Updated: ${result.updated}, Failed again: ${result.failed}`);
}

void runCli(main);
