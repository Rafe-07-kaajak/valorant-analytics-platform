import { loadRuntimePackageBuildConfig } from "../runtimePackage/config";
import { validateRuntimePackage } from "../runtimePackage/validate";
import { runRuntimePackageCli, parseCliArgs } from "./runtimePackageCliSupport";

/** `pnpm runtime:package:validate [-- --dir <path>]` — validates an already-built package (hash agreement, version agreement, row-count/duplicate checks) without touching source data. Defaults to `RUNTIME_PACKAGE_OUTPUT_DIR`. */
async function main(): Promise<void> {
  const { options } = parseCliArgs(process.argv.slice(2));
  const dir = options.get("dir") ?? loadRuntimePackageBuildConfig().outputDir;

  const result = await validateRuntimePackage(dir);

  if (result.valid && result.manifest) {
    console.log(`Runtime package is valid.`);
    console.log(`Runtime package version: ${result.manifest.runtimePackageVersion}`);
    console.log(`Model version: ${result.manifest.modelVersion} (${result.manifest.estimatorType})`);
    console.log(`Historical rows: ${result.manifest.historical.rowCount}, catalog entries: ${result.manifest.historical.catalogCount}`);
    console.log(`Generated at: ${result.manifest.generatedAt}`);
  } else {
    console.error(`Runtime package is INVALID: [${result.error?.code}] ${result.error?.message}`);
    process.exitCode = 3;
  }
}

void runRuntimePackageCli(main);
