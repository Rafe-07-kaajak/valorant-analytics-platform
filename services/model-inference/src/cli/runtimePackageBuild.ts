import { loadRuntimePackageBuildConfig, describeRuntimePackageBuildConfig } from "../runtimePackage/config";
import { buildRuntimePackage } from "../runtimePackage/build";
import { runRuntimePackageCli } from "./runtimePackageCliSupport";

/**
 * `pnpm runtime:package:build` — the one command that reads the real local
 * model artifact and feature dataset and writes a runtime package into the
 * gitignored staging directory. Network-free; never mutates any source
 * directory; never run by `pnpm build`/`pnpm test`/CI.
 */
async function main(): Promise<void> {
  const config = loadRuntimePackageBuildConfig();
  console.log(describeRuntimePackageBuildConfig(config));
  console.log("");

  const result = await buildRuntimePackage(config);

  console.log(`Runtime package version: ${result.manifest.runtimePackageVersion}`);
  console.log(`Model version: ${result.manifest.modelVersion} (${result.manifest.estimatorType}, calibration: ${result.manifest.calibrationMethod})`);
  console.log(`Source feature dataset version: ${result.manifest.sourceFeatureDatasetVersion}`);
  console.log(`Historical rows: ${result.manifest.historical.rowCount}, catalog entries: ${result.manifest.historical.catalogCount}`);
  console.log(`Size summary (bytes): model=${result.manifest.sizeSummaryBytes.modelTotalBytes}, historical=${result.manifest.sizeSummaryBytes.historicalTotalBytes}, manifest=${result.manifest.sizeSummaryBytes.manifestBytes}, total=${result.manifest.sizeSummaryBytes.grandTotalBytes}`);
  console.log(`Package written to: ${result.outputDir}`);
}

void runRuntimePackageCli(main);
