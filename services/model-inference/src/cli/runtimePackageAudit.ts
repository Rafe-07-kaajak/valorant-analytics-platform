import { writeFile } from "node:fs/promises";
import { loadRuntimePackageBuildConfig, describeRuntimePackageBuildConfig } from "../runtimePackage/config";
import { runRuntimePackageAudit } from "../runtimePackage/audit";
import { runRuntimePackageCli } from "./runtimePackageCliSupport";
import { localReportPath } from "./localReportDir";

/** `pnpm runtime:package:audit` — read-only source readiness check (does the source model artifact validate? does the source feature dataset validate? do their versions agree?). Never writes to a source directory; persists a JSON report to `services/model-inference/.local/runtime-package-audit.json`. */
async function main(): Promise<void> {
  const config = loadRuntimePackageBuildConfig();
  console.log(describeRuntimePackageBuildConfig(config));
  console.log("");

  const report = await runRuntimePackageAudit(config);

  const reportPath = await localReportPath("runtime-package-audit.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");

  console.log(`Source model valid: ${report.sourceModelValid}${report.sourceModelError ? ` (${report.sourceModelError})` : ""}`);
  console.log(`Source feature dataset valid: ${report.sourceFeatureDatasetValid}${report.sourceFeatureDatasetError ? ` (${report.sourceFeatureDatasetError})` : ""}`);
  console.log(`Versions agree: ${report.versionsAgree}`);
  if (report.modelVersion) console.log(`Model version: ${report.modelVersion} (${report.estimatorType})`);
  if (report.sourceFeatureDatasetVersion) console.log(`Source feature dataset version: ${report.sourceFeatureDatasetVersion}, rows: ${report.historicalRowCount}`);
  console.log(`Ready to build: ${report.readyToBuild}`);
  console.log("");
  console.log(`Full report written to: ${reportPath}`);

  if (!report.readyToBuild) process.exitCode = 2;
}

void runRuntimePackageCli(main);
