import { readFile } from "node:fs/promises";
import { loadVlrIngestionConfig } from "../env";
import { resolveSafePath } from "../persistence/pathSafety";
import { runCli } from "./cliSupport";

/** `pnpm ingest:vlr:features:status` — TASK-044 requirement 23. Read-only summary of the feature export's current on-disk state. No network. */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const manifestPath = resolveSafePath(config.dataDir, "features", "feature-manifest.json");

  console.log(`Data directory: ${config.dataDir}`);
  console.log(`Feature directory: ${config.dataDir}/features/`);
  console.log("");

  let raw: string;
  try {
    raw = await readFile(manifestPath, "utf-8");
  } catch {
    console.log("No feature dataset found yet. Next step: pnpm ingest:vlr:features:build");
    return;
  }

  const manifest = JSON.parse(raw);
  console.log("=== Feature dataset manifest ===");
  console.log(JSON.stringify(manifest, null, 2));
}

void runCli(main);
