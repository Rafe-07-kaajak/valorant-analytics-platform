import { loadRuntimePackageBuildConfig } from "../runtimePackage/config";
import { loadRuntimePackage } from "../runtimePackage/loader";
import { isRuntimePackageError } from "../runtimePackage/runtimePackageErrors";
import { runRuntimePackageCli } from "./runtimePackageCliSupport";

/** `pnpm runtime:package:status` — prints a human-readable summary of the currently-built package, or reports "not built" if absent. Never throws for a missing package (that is the expected "not built yet" state, not a CLI failure). */
async function main(): Promise<void> {
  const config = loadRuntimePackageBuildConfig();

  try {
    const loaded = await loadRuntimePackage(config.outputDir, { maxFileBytes: config.maxFileBytes });
    console.log(`Runtime package: built and valid.`);
    console.log(`Runtime package version: ${loaded.manifest.runtimePackageVersion}`);
    console.log(`Model version: ${loaded.manifest.modelVersion} (${loaded.manifest.estimatorType}, calibration: ${loaded.manifest.calibrationMethod})`);
    console.log(`Source feature dataset version: ${loaded.manifest.sourceFeatureDatasetVersion}`);
    console.log(`Historical rows: ${loaded.manifest.historical.rowCount}, catalog entries: ${loaded.manifest.historical.catalogCount}`);
    console.log(`Size summary (bytes): model=${loaded.manifest.sizeSummaryBytes.modelTotalBytes}, historical=${loaded.manifest.sizeSummaryBytes.historicalTotalBytes}, total=${loaded.manifest.sizeSummaryBytes.grandTotalBytes}`);
    console.log(`Generated at: ${loaded.manifest.generatedAt}`);
    console.log(`Supported runtime targets: ${loaded.manifest.runtimeTargets.supported.join(", ")}`);
    console.log(`Conditional runtime targets: ${loaded.manifest.runtimeTargets.conditional.join(", ")}`);
    console.log(`Unsupported runtime targets: ${loaded.manifest.runtimeTargets.unsupported.join(", ")}`);
  } catch (error) {
    if (isRuntimePackageError(error) && error.code === "runtime_package_missing") {
      console.log("Runtime package: not built. Run `pnpm runtime:package:build` to create one.");
      return;
    }
    throw error;
  }
}

void runRuntimePackageCli(main);
