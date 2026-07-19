import { loadModelInferenceConfig } from "../config";
import { PredictionService } from "../predictionService";
import { runInferenceCli } from "./cliSupport";

/** `pnpm inference:model:reload` — TASK-046 requirement 16/19. Loads first (if not already loaded), then triggers an explicit reload and reports whether the candidate replaced the running model or was rejected in favor of the previously healthy one. */
async function main(): Promise<void> {
  const config = loadModelInferenceConfig();
  const service = new PredictionService(config);
  const before = await service.start();
  const after = await service.reload();

  console.log(JSON.stringify({ before, after }, null, 2));

  if (after.lastLoadError && before.modelVersion === after.modelVersion) {
    console.log("");
    console.log(`Reload failed (${after.lastLoadError.code}); the previously loaded model version was preserved.`);
  }
  if (!after.ready && !after.fallbackActive) process.exitCode = 2;
}

void runInferenceCli(main);
