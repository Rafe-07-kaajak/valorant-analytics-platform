import { loadVlrIngestionConfig } from "../env";
import { IngestionError } from "../errors";
import { buildCanonicalTargetScope } from "../scope/backfillScope";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { loadEventDiscoveryManifest } from "../discovery/eventManifest";
import { loadMatchDiscoveryManifest } from "../discovery/matchManifest";
import { buildDatasetManifest, saveDatasetManifest } from "../discovery/datasetManifest";
import { runCli } from "./cliSupport";

/**
 * `pnpm ingest:vlr:manifest` — TASK-042 requirement 21. Builds and persists
 * the dataset version manifest from the already-persisted store and
 * manifests; never touches the network. Dataset identity is deterministic
 * (see `datasetVersionHash`), never a random UUID.
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

  const scope = buildCanonicalTargetScope();
  const manifest = await buildDatasetManifest(store, scope, config, eventManifest, matchManifest);
  await saveDatasetManifest(store, manifest);

  console.log("=== Dataset manifest ===");
  console.log(JSON.stringify(manifest, null, 2));
}

void runCli(main);
