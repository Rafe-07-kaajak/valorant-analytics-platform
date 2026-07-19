import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadVlrIngestionConfig } from "../env";
import { loadModelArtifactForInference } from "../modeling/artifact";
import { predict, type ModelInputRow } from "../modeling/inference";
import { ModelingError } from "../modeling/errors";
import { runModelingCli } from "../modeling/cliSupport";

/** `pnpm ingest:model:predict -- <feature-row-file>` — TASK-045 requirement 19/18. Offline inference over a single JSON feature row using the frozen artifact. No network; never modifies the artifact or feature source files. */
async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath || filePath.trim().length === 0) {
    throw new ModelingError("input_validation_failed", "Missing required argument: <feature-row-file>. Usage: pnpm ingest:model:predict -- <feature-row-file>");
  }

  const config = loadVlrIngestionConfig();
  const artifact = await loadModelArtifactForInference(config.dataDir);

  let raw: string;
  try {
    raw = await readFile(resolve(filePath.trim()), "utf-8");
  } catch {
    throw new ModelingError("input_validation_failed", `Could not read feature-row file "${filePath}".`);
  }

  let row: ModelInputRow;
  try {
    row = JSON.parse(raw) as ModelInputRow;
  } catch {
    throw new ModelingError("input_validation_failed", `Feature-row file "${filePath}" is not valid JSON.`);
  }

  const result = predict(artifact, row);
  console.log(`Model version: ${artifact.manifest.modelVersion}`);
  console.log(`Estimator: ${artifact.manifest.estimatorType}, calibration: ${artifact.manifest.calibrationMethod}`);
  console.log("");
  console.log(JSON.stringify(result, null, 2));
}

void runModelingCli(main);
