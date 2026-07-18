import { describeConfig, loadVlrIngestionConfig } from "../env";
import { buildCanonicalTargetScope, serializeBackfillScope, validateBackfillScope } from "../scope/backfillScope";
import { runCli } from "./cliSupport";

/**
 * `pnpm ingest:scope:dry-run` — see docs/29-vlr-data-ingestion-foundation.md
 * ("Commands") and TASK-041 requirement 23. Prints the canonical TASK-042
 * target scope and the current safety policy. Performs no network access
 * and persists nothing — live event/match discovery against this scope is
 * TASK-042's job, not this foundation's.
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const scope = buildCanonicalTargetScope();
  const validation = validateBackfillScope(scope);

  console.log("VLR backfill scope — dry run (no network access performed)");
  console.log("");
  console.log(`Date range: ${scope.startDate} through ${scope.endDate} (completed matches only)`);
  console.log(`Approved event families: ${scope.eventFamilies.join(", ")}`);
  console.log("Excluded categories: excluded-tier-2, excluded-qualifier, excluded-game-changers, excluded-showmatch, excluded-unrelated, unknown");
  console.log(`Bounds: maximumEvents=${scope.maximumEvents}, maximumMatches=${scope.maximumMatches}`);
  console.log("");
  console.log("Request/rate policy that a live run would use:");
  console.log(describeConfig(config));
  console.log("");
  console.log(`Scope valid: ${validation.valid}`);
  if (!validation.valid) console.log(`Validation errors: ${validation.errors.join("; ")}`);
  console.log(`Serialized scope key: ${serializeBackfillScope(scope)}`);
  console.log("");
  console.log("This command does not perform live event/match discovery. That is TASK-042's historical backfill, built on this scope model.");

  if (!validation.valid) process.exitCode = 3;
}

void runCli(main);
