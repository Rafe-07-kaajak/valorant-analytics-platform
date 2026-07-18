import { readFile } from "node:fs/promises";
import { loadVlrIngestionConfig } from "../env";
import { resolveSafePath } from "../persistence/pathSafety";
import { runCli } from "./cliSupport";

/** `pnpm ingest:vlr:curated:status` — TASK-043 requirement 20. Read-only summary of the curated export's current on-disk state. No network. */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const manifestPath = resolveSafePath(config.dataDir, "curated", "dataset-manifest.json");

  console.log(`Data directory: ${config.dataDir}`);
  console.log(`Curated directory: ${config.dataDir}/curated/`);
  console.log("");

  let raw: string;
  try {
    raw = await readFile(manifestPath, "utf-8");
  } catch {
    console.log("No curated dataset found yet. Next step: pnpm ingest:vlr:curate");
    return;
  }

  const manifest = JSON.parse(raw);
  console.log("=== Curated dataset manifest ===");
  console.log(JSON.stringify(manifest, null, 2));
}

void runCli(main);
