import { loadVlrIngestionConfig } from "../env";
import { readArtifactFile } from "../modeling/artifact";
import { runModelingCli } from "../modeling/cliSupport";

/** `pnpm ingest:model:select` — read-only report of the frozen model-selection rationale and the candidate evidence it was based on. No network. */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const [manifest, modelCard] = await Promise.all([readArtifactFile(config.dataDir, "model-manifest.json"), readArtifactFile(config.dataDir, "model-card.json")]);

  console.log(`Data directory: ${config.dataDir}`);
  console.log("");
  console.log(`Selected estimator: ${manifest.estimatorType}`);
  console.log(`Model version: ${manifest.modelVersion}`);
  console.log("");
  console.log(`Selection rationale: ${manifest.selectionRationale}`);
  console.log("");
  console.log("=== Candidates evaluated ===");
  console.log(JSON.stringify(modelCard.candidatesEvaluated, null, 2));
  console.log("");
  console.log("=== Backtest summary (family comparison) ===");
  console.log(JSON.stringify(modelCard.backtestSummary, null, 2));
}

void runModelingCli(main);
