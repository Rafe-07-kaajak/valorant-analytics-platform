import { loadVlrIngestionConfig } from "../env";
import { readArtifactFile } from "../modeling/artifact";
import { runModelingCli } from "../modeling/cliSupport";

/** `pnpm ingest:model:backtest` — read-only per-fold walk-forward report for the frozen selected model. No network; no retraining. */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const evaluation = await readArtifactFile(config.dataDir, "evaluation.json");

  console.log(`Data directory: ${config.dataDir}`);
  console.log(`Fold count: ${evaluation.walkForward.folds.length}`);
  console.log("");
  for (const fold of evaluation.walkForward.folds) {
    console.log(`Fold ${fold.foldId}: train ${fold.trainRowCount} rows (${fold.trainStartIso} - ${fold.trainEndIso}), validation ${fold.validationRowCount} rows (${fold.validationStartIso} - ${fold.validationEndIso})`);
    console.log(`  logLoss=${fold.metrics.logLoss.toFixed(4)} brier=${fold.metrics.brierScore.toFixed(4)} rocAuc=${fold.metrics.rocAuc?.toFixed(4) ?? "n/a"} accuracy=${fold.metrics.accuracy.toFixed(4)}`);
  }
  console.log("");
  console.log(`Mean log loss: ${evaluation.walkForward.meanLogLoss.toFixed(4)}`);
  console.log(`Median log loss: ${evaluation.walkForward.medianLogLoss.toFixed(4)}`);
  console.log(`Mean Brier score: ${evaluation.walkForward.meanBrierScore.toFixed(4)}`);
  console.log("");
  console.log("=== Pooled metrics (all folds combined) ===");
  console.log(JSON.stringify(evaluation.walkForward.pooledMetrics, null, 2));
}

void runModelingCli(main);
