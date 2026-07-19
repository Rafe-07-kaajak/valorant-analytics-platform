import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadModelInferenceConfig } from "../config";
import { PredictionService } from "../predictionService";
import { InferenceError } from "../errors";
import { runInferenceCli } from "./cliSupport";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * `pnpm inference:model:predict -- <feature-row-file>` — TASK-046
 * requirement 19. Accepts either a full `InferenceRequest` JSON object (with
 * a `features` key) or a bare flat feature row (e.g. a TASK-044 curated
 * feature row) — `featureSchemaVersion`/`featureRulesVersion` are filled in
 * automatically from the loaded artifact's own feature contract in the
 * latter case, matching `services/vlr-ingestion/src/cli/modelPredict.ts`'s
 * ergonomics. Never modifies the input file, the artifact, or any feature
 * source file.
 */
async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath || filePath.trim().length === 0) {
    throw new InferenceError("invalid_feature_value", "Missing required argument: <feature-row-file>. Usage: pnpm inference:model:predict -- <feature-row-file>");
  }

  const config = loadModelInferenceConfig();
  const service = new PredictionService(config);
  await service.start();

  let raw: string;
  try {
    raw = await readFile(resolve(filePath.trim()), "utf-8");
  } catch {
    throw new InferenceError("invalid_feature_value", `Could not read feature-row file "${filePath}".`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InferenceError("invalid_feature_value", `Feature-row file "${filePath}" is not valid JSON.`);
  }

  const snapshot = service.internalStatus().registry;
  const request = isPlainObject(parsed) && isPlainObject(parsed.features) ? parsed : { featureSchemaVersion: snapshot.featureSchemaVersion, featureRulesVersion: snapshot.featureRulesVersion, features: parsed };

  const response = await service.predict(request);
  console.log(JSON.stringify(response, null, 2));
}

void runInferenceCli(main);
