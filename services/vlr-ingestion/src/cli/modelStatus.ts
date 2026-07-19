import { loadVlrIngestionConfig } from "../env";
import { readArtifactFile } from "../modeling/artifact";
import { runModelingCli } from "../modeling/cliSupport";

/** `pnpm ingest:model:status` — read-only summary of the current model artifact's on-disk state. No network. */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();

  console.log(`Data directory: ${config.dataDir}`);
  console.log(`Model directory: ${config.dataDir}/models/selected-model/`);
  console.log("");

  let manifest;
  try {
    manifest = await readArtifactFile(config.dataDir, "model-manifest.json");
  } catch {
    console.log("No model artifact found yet. Next step: pnpm ingest:model:train");
    return;
  }

  console.log("=== Model manifest ===");
  console.log(JSON.stringify(manifest, null, 2));
}

void runModelingCli(main);
