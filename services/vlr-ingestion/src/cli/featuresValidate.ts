import { loadVlrIngestionConfig } from "../env";
import { runFeatureBuild } from "../feature/featureBuild";
import { runCli } from "./cliSupport";

/**
 * `pnpm ingest:vlr:features:validate` — TASK-044 hard validation gate.
 * Rebuilds the feature rows/splits in memory (no disk writes) and exits
 * non-zero on any fatal validation error. Read-only; never makes a network
 * request.
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const result = await runFeatureBuild(config.dataDir);

  console.log(`Data directory: ${config.dataDir}`);
  console.log("");
  console.log(`Row count: ${result.rows.length}`);
  console.log(`Rejected matches: ${result.rejected.length}`);
  for (const rejection of result.rejected.slice(0, 20)) console.log(`  REJECTED: ${rejection.matchInternalId} — ${rejection.reason}`);
  console.log("");
  console.log(`Row validation valid: ${result.rowValidation.valid}`);
  console.log(`Row validation errors: ${result.rowValidation.errors.length}`);
  for (const error of result.rowValidation.errors.slice(0, 50)) console.log(`  FAIL: ${error}`);
  if (result.rowValidation.errors.length > 50) console.log(`  ... and ${result.rowValidation.errors.length - 50} more error(s).`);
  console.log(`Row validation warnings: ${result.rowValidation.warnings.length}`);
  for (const warning of result.rowValidation.warnings.slice(0, 20)) console.log(`  WARN: ${warning}`);
  console.log("");
  console.log(`Split validation valid: ${result.splitValidation.valid}`);
  for (const error of result.splitValidation.errors.slice(0, 50)) console.log(`  FAIL: ${error}`);
  console.log("");
  console.log("Statistics:", JSON.stringify(result.rowValidation.statistics));

  if (!result.rowValidation.valid || !result.splitValidation.valid) {
    process.exitCode = 1;
  }
}

void runCli(main);
