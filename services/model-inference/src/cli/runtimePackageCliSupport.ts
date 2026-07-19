import { isRuntimePackageError, toSafeRuntimePackageError, type RuntimePackageErrorCode } from "../runtimePackage/runtimePackageErrors";

/** Mirrors `cliSupport.ts`'s `runInferenceCli` — every `runtime:package:*` command shares one error-to-exit-code mapping so failures are reported consistently and never print a raw stack trace. */
export async function runRuntimePackageCli(main: () => Promise<void>): Promise<void> {
  try {
    await main();
  } catch (error) {
    const safe = toSafeRuntimePackageError(error);
    console.error(`Runtime package command failed: [${safe.code}] ${safe.message}`);
    process.exitCode = isRuntimePackageError(error) ? exitCodeForCode(safe.code) : 1;
  }
}

const NOT_FOUND_CODES: readonly RuntimePackageErrorCode[] = ["runtime_package_missing"];
const VALIDATION_CODES: readonly RuntimePackageErrorCode[] = ["runtime_package_manifest_invalid", "runtime_package_hash_mismatch", "runtime_package_version_mismatch", "runtime_package_model_mismatch", "runtime_package_feature_mismatch", "runtime_package_row_count_mismatch", "runtime_package_unsafe_path", "runtime_package_unsupported_target"];

function exitCodeForCode(code: RuntimePackageErrorCode): number {
  if (NOT_FOUND_CODES.includes(code)) return 2;
  if (VALIDATION_CODES.includes(code)) return 3;
  return 1;
}

/** Minimal `--flag`/`--key value` argv parser, avoiding a new dependency for a handful of CLI flags. */
export function parseCliArgs(argv: readonly string[]): { readonly flags: ReadonlySet<string>; readonly options: ReadonlyMap<string, string> } {
  const flags = new Set<string>();
  const options = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      options.set(key, next);
      i++;
    } else {
      flags.add(key);
    }
  }
  return { flags, options };
}
