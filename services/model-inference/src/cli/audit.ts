import { writeFile } from "node:fs/promises";
import { loadModelInferenceConfig, describeModelInferenceConfig } from "../config";
import { LocalFilesystemArtifactSource } from "../artifactSource";
import { runArtifactAudit } from "../audit";
import { runInferenceCli } from "./cliSupport";
import { localReportPath } from "./localReportDir";

/** `pnpm inference:model:audit` — TASK-046 requirement 2/19. Read-only, network-free; persists a JSON report to `services/model-inference/.local/model-inference-audit.json`. */
async function main(): Promise<void> {
  const config = loadModelInferenceConfig();
  console.log(describeModelInferenceConfig(config));
  console.log("");

  const source = new LocalFilesystemArtifactSource(config.artifactDir);
  const report = await runArtifactAudit(source, config);

  const reportPath = await localReportPath("model-inference-audit.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");

  console.log(`Artifact directory id: ${report.artifactDirectoryId}`);
  console.log(`Critical files present: ${report.criticalFilesPresent}`);
  console.log(`Overall ready: ${report.overallReady}`);
  if (report.manifestSummary) {
    console.log(`Model version: ${report.manifestSummary.modelVersion}`);
    console.log(`Estimator: ${report.manifestSummary.estimatorType}, calibration: ${report.manifestSummary.calibrationMethod}`);
    console.log(`Source feature dataset version: ${report.manifestSummary.sourceFeatureDatasetVersion}`);
  }
  if (report.loadError) console.log(`Load error: [${report.loadError.code}] ${report.loadError.message}`);
  for (const warning of report.warnings) console.log(`Warning: ${warning}`);
  console.log("");
  console.log(`Full report written to: ${reportPath}`);

  if (!report.overallReady) process.exitCode = 2;
}

void runInferenceCli(main);
