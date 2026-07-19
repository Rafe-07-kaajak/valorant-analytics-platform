import { loadModelInferenceConfig, describeModelInferenceConfig } from "../config";
import { PredictionService } from "../predictionService";
import { runInferenceCli } from "./cliSupport";

/** `pnpm inference:model:load` — TASK-046 requirement 19. Loads the configured artifact, validates it, and runs the startup self-test, printing the resulting registry snapshot. Network-free; never modifies the artifact. */
async function main(): Promise<void> {
  const config = loadModelInferenceConfig();
  console.log(describeModelInferenceConfig(config));
  console.log("");

  const service = new PredictionService(config);
  const snapshot = await service.start();

  console.log(JSON.stringify(snapshot, null, 2));
  if (!snapshot.ready && !snapshot.fallbackActive) process.exitCode = 2;
}

void runInferenceCli(main);
