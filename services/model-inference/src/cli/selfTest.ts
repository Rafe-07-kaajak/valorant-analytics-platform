import { loadModelInferenceConfig } from "../config";
import { LocalFilesystemArtifactSource } from "../artifactSource";
import { validateArtifact } from "../artifactValidator";
import { toLoadedModelArtifact } from "../inferenceAdapter";
import { runSelfTest } from "../selfTest";
import { runInferenceCli } from "./cliSupport";

/** `pnpm inference:model:self-test` — TASK-046 requirement 7/19. Runs the deterministic startup self-test in isolation (independent of the registry), for debugging a load failure. */
async function main(): Promise<void> {
  const config = loadModelInferenceConfig();
  const source = new LocalFilesystemArtifactSource(config.artifactDir);
  const { files } = await validateArtifact(source, config);
  const artifact = toLoadedModelArtifact(files);
  const report = runSelfTest(artifact);
  console.log(JSON.stringify(report, null, 2));
}

void runInferenceCli(main);
