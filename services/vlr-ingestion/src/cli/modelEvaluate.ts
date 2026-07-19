import { loadVlrIngestionConfig } from "../env";
import { readArtifactFile } from "../modeling/artifact";
import { runModelingCli } from "../modeling/cliSupport";

/** `pnpm ingest:model:evaluate` — read-only report of the frozen model's validation/walk-forward/test metrics (`evaluation.json`). Never re-evaluates or re-touches the test split; only prints what `model:train` already computed. No network. */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const evaluation = await readArtifactFile(config.dataDir, "evaluation.json");

  console.log(`Data directory: ${config.dataDir}`);
  console.log("");
  console.log("=== Validation metrics ===");
  console.log(JSON.stringify(evaluation.validationMetrics, null, 2));
  console.log("");
  console.log("=== Walk-forward aggregate ===");
  console.log(JSON.stringify({ meanLogLoss: evaluation.walkForward.meanLogLoss, medianLogLoss: evaluation.walkForward.medianLogLoss, meanBrierScore: evaluation.walkForward.meanBrierScore, foldCount: evaluation.walkForward.folds.length }, null, 2));
  console.log("");
  console.log("=== Final test metrics (calibrated) ===");
  console.log(JSON.stringify(evaluation.testMetricsCalibrated, null, 2));
  console.log("");
  console.log("=== Baseline test metrics ===");
  console.log(JSON.stringify(evaluation.baselineTestMetrics, null, 2));
  console.log("");
  console.log("=== Uncertainty (bootstrap 95% CI) ===");
  console.log(JSON.stringify(evaluation.uncertainty, null, 2));
}

void runModelingCli(main);
