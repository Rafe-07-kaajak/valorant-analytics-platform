import { loadVlrIngestionConfig } from "../env";
import { runModelTrainingPipeline, buildModelManifest, buildArtifactFiles } from "../modeling/pipeline";
import { buildModelCard } from "../modeling/modelCard";
import { writeModelArtifact } from "../modeling/artifact";
import { runModelingCli } from "../modeling/cliSupport";

/**
 * `pnpm ingest:model:train` — TASK-045 requirement 26. The single
 * "one-command rebuild": runs the feasibility audit, trains every baseline
 * and candidate configuration, walk-forward backtests the winning
 * candidates, selects and calibrates the frozen model using train/
 * validation/walk-forward evidence only, evaluates it exactly once on the
 * held-out test split, and serializes the resulting artifact. Read-only
 * over `features/`; never makes a network request; never writes outside
 * `<dataDir>/models/selected-model/`.
 */
async function main(): Promise<void> {
  const config = loadVlrIngestionConfig();
  const generatedAt = new Date().toISOString();

  const result = await runModelTrainingPipeline(config.dataDir, generatedAt);

  const manifestDraft = buildModelManifest(result);
  const modelCard = buildModelCard(result);
  const draftFiles = buildArtifactFiles(result, manifestDraft, modelCard);
  const draftHashes = await writeModelArtifact(config.dataDir, draftFiles);
  const contentHashes = { ...draftHashes };
  delete contentHashes["model-manifest.json"];

  const manifestFinal = { ...manifestDraft, contentHashes };
  const finalFiles = buildArtifactFiles(result, manifestFinal, modelCard);
  const finalHashes = await writeModelArtifact(config.dataDir, finalFiles);

  console.log(`Data directory: ${config.dataDir}`);
  console.log(`Model output: ${config.dataDir}/models/selected-model/`);
  console.log("");
  console.log(`Selected estimator: ${result.selectedEstimatorType}`);
  console.log(`Calibration: ${result.finalCalibration.method}`);
  console.log(`Model version: ${result.modelVersion}`);
  console.log("");
  console.log(`Selection rationale: ${result.selectionRationale}`);
  console.log(`Calibration rationale: ${result.calibrationRationale}`);
  console.log("");
  console.log("=== Final test metrics (calibrated) ===");
  console.log(JSON.stringify(result.evaluation.testMetricsCalibrated, null, 2));
  console.log("");
  console.log("=== Elo baseline test metrics ===");
  console.log(JSON.stringify(result.evaluation.baselineTestMetrics["elo-baseline"], null, 2));
  console.log("");
  console.log(`Total model fits: ${result.totalModelFits}`);
  console.log(`Training runtime: ${result.trainingRuntimeMs}ms`);
  console.log("");
  console.log("File content hashes (for idempotency verification):");
  for (const [fileName, hash] of Object.entries(finalHashes)) console.log(`  ${fileName}: ${hash}`);
}

void runModelingCli(main);
