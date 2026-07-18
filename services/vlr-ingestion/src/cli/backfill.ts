import { describeConfig, loadVlrIngestionConfig } from "../env";
import { IngestionError } from "../errors";
import { buildCanonicalTargetScope } from "../scope/backfillScope";
import { buildTeamMappingLookup, validateTeamMappingRegistry, INITIAL_TEAM_MAPPING_REGISTRY } from "../identity/teamMapping";
import { RealVlrProvider } from "../vlr/realVlrProvider";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { loadEventDiscoveryManifest } from "../discovery/eventManifest";
import { loadMatchDiscoveryManifest } from "../discovery/matchManifest";
import { runBackfillBatch } from "../ingestion/backfillRunner";
import { runCli } from "./cliSupport";

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 500;

function parseBatchSize(argv: readonly string[]): number {
  const flagIndex = argv.indexOf("--batch-size");
  if (flagIndex === -1) return DEFAULT_BATCH_SIZE;
  const raw = argv[flagIndex + 1];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new IngestionError("invalid_backfill_scope", `--batch-size must be a positive integer (got "${raw}").`);
  }
  return Math.min(parsed, MAX_BATCH_SIZE);
}

/**
 * `pnpm ingest:vlr:backfill -- --batch-size 50` — TASK-042 requirements
 * 8/9. Fetches match detail for up to `batchSize` not-yet-completed matches
 * from the persisted match manifest, normalizes, and persists. Idempotent
 * and safe to run repeatedly ("resume" is this same command) — a match
 * already normalized as completed is never re-fetched, and failures land in
 * the failure ledger rather than aborting the batch.
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const batchSize = parseBatchSize(process.argv);

  console.log("Rate/concurrency policy for this run:");
  console.log(describeConfig(config));
  console.log(`Batch size: ${batchSize}`);
  console.log(`Data directory: ${config.dataDir}`);
  console.log("");

  if (!config.networkEnabled) {
    throw new IngestionError("network_disabled", "Set VLR_NETWORK_ENABLED=true to run a live backfill batch.");
  }

  const teamMappingValidation = validateTeamMappingRegistry(INITIAL_TEAM_MAPPING_REGISTRY);
  if (!teamMappingValidation.valid) {
    throw new IngestionError("mapping_conflict", `Team mapping registry is invalid: ${JSON.stringify(teamMappingValidation.conflicts)}`);
  }
  const teamMapping = buildTeamMappingLookup(INITIAL_TEAM_MAPPING_REGISTRY);

  const store = new FilesystemIngestionStore(config.dataDir);
  const matchManifest = await loadMatchDiscoveryManifest(store);
  if (!matchManifest) {
    throw new IngestionError("checkpoint_failure", "No match discovery manifest found. Run `pnpm ingest:vlr:discover` first.");
  }
  const eventManifest = await loadEventDiscoveryManifest(store);
  if (!eventManifest) {
    throw new IngestionError("checkpoint_failure", "No event discovery manifest found. Run `pnpm ingest:vlr:discover` first.");
  }

  const scope = buildCanonicalTargetScope();
  const provider = new RealVlrProvider(config);

  console.log(`Match manifest: ${matchManifest.entries.length} discovered link(s).`);
  console.log("Running batch...");
  const startedAt = Date.now();

  const result = await runBackfillBatch({ provider, store, teamMapping }, matchManifest, scope, batchSize, {
    onProgress: ({ vlrMatchId, processed, batchSize: total }) => console.log(`  [${processed}/${total}] fetching match ${vlrMatchId}`),
  });

  const durationMs = Date.now() - startedAt;
  console.log("");
  console.log("=== Batch complete ===");
  console.log(`Processed: ${result.processed} (of ${result.candidatesConsidered} remaining candidates)`);
  console.log(`Inserted: ${result.inserted}, Updated: ${result.updated}, Unchanged: ${result.unchanged}, Failed: ${result.failed}`);
  console.log(`Still pending after this batch: ${result.remainingPendingCount}`);
  console.log(`Duration: ${Math.round(durationMs / 1000)}s`);

  if (result.circuitBreakerTripped) {
    console.log("");
    console.log("PARSER CIRCUIT BREAKER TRIPPED: several consecutive matches failed to parse. This usually means VLR's match-detail markup has changed — investigate before retrying.");
    console.log("Stopped early to avoid writing a run of malformed records. Already-processed matches this batch remain persisted (nothing was corrupted).");
    process.exitCode = 1;
  } else if (result.remainingPendingCount > 0) {
    console.log("");
    console.log(`Backfill is not yet complete. Resume with: pnpm ingest:vlr:backfill --batch-size ${batchSize}`);
  } else {
    console.log("");
    console.log("No pending completed matches remain in the current match manifest.");
  }

  if (result.failed > 0) {
    console.log(`${result.failed} failure(s) were recorded in the failure ledger this batch. Review with: pnpm ingest:vlr:status, retry with: pnpm ingest:vlr:retry`);
  }
}

void runCli(main);
