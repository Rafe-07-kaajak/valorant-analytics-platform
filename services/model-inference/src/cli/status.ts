import { loadModelInferenceConfig } from "../config";
import { PredictionService } from "../predictionService";
import { runInferenceCli } from "./cliSupport";

/** `pnpm inference:model:status` — TASK-046 requirement 19. Loads the model, then prints the internal (safe) status: registry state, metadata, and metrics counters. */
async function main(): Promise<void> {
  const config = loadModelInferenceConfig();
  const service = new PredictionService(config);
  await service.start();
  console.log(JSON.stringify(service.internalStatus(), null, 2));
}

void runInferenceCli(main);
