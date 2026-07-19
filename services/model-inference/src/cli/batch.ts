import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadModelInferenceConfig } from "../config";
import { PredictionService } from "../predictionService";
import { InferenceError } from "../errors";
import { runInferenceCli } from "./cliSupport";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `pnpm inference:model:batch -- <feature-rows-file>` — TASK-046 requirement 14/19. `<feature-rows-file>` is a JSON array of either full `InferenceRequest` objects or bare flat feature rows. */
async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath || filePath.trim().length === 0) {
    throw new InferenceError("invalid_feature_value", "Missing required argument: <feature-rows-file>. Usage: pnpm inference:model:batch -- <feature-rows-file>");
  }

  const config = loadModelInferenceConfig();
  const service = new PredictionService(config);
  await service.start();

  let raw: string;
  try {
    raw = await readFile(resolve(filePath.trim()), "utf-8");
  } catch {
    throw new InferenceError("invalid_feature_value", `Could not read feature-rows file "${filePath}".`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InferenceError("invalid_feature_value", `Feature-rows file "${filePath}" is not valid JSON.`);
  }
  if (!Array.isArray(parsed)) {
    throw new InferenceError("invalid_feature_value", `Feature-rows file "${filePath}" must contain a JSON array.`);
  }

  const snapshot = service.internalStatus().registry;
  const requests = parsed.map((entry) => (isPlainObject(entry) && isPlainObject(entry.features) ? entry : { featureSchemaVersion: snapshot.featureSchemaVersion, featureRulesVersion: snapshot.featureRulesVersion, features: entry }));

  const result = await service.predictBatch(requests);
  console.log(JSON.stringify(result, null, 2));
  console.log("");
  console.log(`${result.successCount} succeeded, ${result.failureCount} failed, total ${result.totalDurationMs.toFixed(2)}ms.`);
  if (result.failureCount > 0) process.exitCode = 3;
}

void runInferenceCli(main);
