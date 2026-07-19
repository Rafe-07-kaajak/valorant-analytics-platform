import { loadVlrIngestionConfig } from "../env";
import { readArtifactFile } from "../modeling/artifact";
import { runModelingCli } from "../modeling/cliSupport";

/** `pnpm ingest:model:calibrate` — read-only report of the calibration method comparison and reliability data the frozen model was selected with. No network. */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const [calibration, modelCard, reliability] = await Promise.all([readArtifactFile(config.dataDir, "calibration.json"), readArtifactFile(config.dataDir, "model-card.json"), readArtifactFile(config.dataDir, "reliability-data.json")]);

  console.log(`Data directory: ${config.dataDir}`);
  console.log("");
  console.log("=== Calibration candidates (validation-set evidence) ===");
  console.log(JSON.stringify(modelCard.calibrationSummary, null, 2));
  console.log("");
  console.log(`Selected calibration method: ${calibration.method}`);
  console.log(JSON.stringify(calibration, null, 2));
  console.log("");
  console.log("=== Test-set reliability bins (pre vs post calibration) ===");
  console.log(JSON.stringify(reliability, null, 2));
}

void runModelingCli(main);
