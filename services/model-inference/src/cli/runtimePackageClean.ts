import { loadRuntimePackageBuildConfig } from "../runtimePackage/config";
import { cleanRuntimePackageOutput, listRuntimePackageOutputContents } from "../runtimePackage/build";
import { runRuntimePackageCli, parseCliArgs } from "./runtimePackageCliSupport";

/** `pnpm runtime:package:clean [-- --dry-run]` — deletes the staging directory's contents. Only ever operates on `RUNTIME_PACKAGE_OUTPUT_DIR`, never a source directory. `--dry-run` lists what would be deleted without deleting anything. */
async function main(): Promise<void> {
  const { flags } = parseCliArgs(process.argv.slice(2));
  const config = loadRuntimePackageBuildConfig();

  const entries = await listRuntimePackageOutputContents(config.outputDir);
  if (entries.length === 0) {
    console.log("Runtime package staging directory is already empty (or does not exist).");
    return;
  }

  if (flags.has("dry-run")) {
    console.log("Dry run: the following top-level entries would be deleted:");
    for (const entry of entries) console.log(`  - ${entry}`);
    return;
  }

  await cleanRuntimePackageOutput(config.outputDir);
  console.log(`Deleted ${entries.length} top-level entr${entries.length === 1 ? "y" : "ies"} from the runtime package staging directory.`);
}

void runRuntimePackageCli(main);
