import { loadVlrIngestionConfig } from "../env";
import { IngestionError } from "../errors";
import { FilesystemIngestionStore } from "../persistence/filesystemStore";
import { loadEventDiscoveryManifest } from "../discovery/eventManifest";
import { loadMatchDiscoveryManifest } from "../discovery/matchManifest";
import { buildQualityReport, formatQualityReport } from "../discovery/qualityReport";
import { runCli } from "./cliSupport";

/**
 * `pnpm ingest:vlr:report` — TASK-042 requirement 14. Reads only the
 * already-persisted store and manifests; never touches the network.
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

  const report = await buildQualityReport(store, eventManifest, matchManifest);
  console.log("=== Data-quality report ===");
  console.log(formatQualityReport(report));
}

void runCli(main);
