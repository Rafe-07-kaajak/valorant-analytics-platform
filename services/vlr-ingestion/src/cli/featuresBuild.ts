import { loadVlrIngestionConfig } from "../env";
import { runFeatureBuildAndWrite } from "../feature/featureBuild";
import { runCli } from "./cliSupport";

/**
 * `pnpm ingest:vlr:features:build` — TASK-044. Reads the TASK-043 curated
 * dataset (`<dataDir>/curated/`), replays it through the chronological
 * feature-state engine, and writes every deterministic output file to
 * `<dataDir>/features/`. Read-only over curated source files; never makes
 * a network request.
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const start = Date.now();
  const result = await runFeatureBuildAndWrite(config.dataDir);
  const durationMs = Date.now() - start;

  console.log(`Data directory: ${config.dataDir}`);
  console.log(`Feature output: ${config.dataDir}/features/`);
  console.log("");
  console.log("=== Feature dataset manifest ===");
  console.log(JSON.stringify(result.files["feature-manifest.json"], null, 2));
  console.log("");
  console.log(`Build runtime: ${durationMs}ms`);
  console.log(`Rejected matches: ${result.rejected.length}`);
  console.log("");
  console.log("File content hashes (for idempotency verification):");
  for (const [fileName, hash] of Object.entries(result.fileHashes)) console.log(`  ${fileName}: ${hash}`);

  if (!result.rowValidation.valid || !result.splitValidation.valid) {
    console.error("");
    console.error("Validation reported fatal errors during build — run `pnpm ingest:vlr:features:validate` for details.");
    process.exitCode = 1;
  }
}

void runCli(main);
