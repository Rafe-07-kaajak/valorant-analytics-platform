import { loadRuntimePackage, type LoadRuntimePackageOptions } from "./loader";
import { toSafeRuntimePackageError, type SafeRuntimePackageErrorJSON } from "./runtimePackageErrors";
import type { RuntimePackageManifest } from "./runtimePackageTypes";

/** Thin wrapper around `loadRuntimePackage` reporting a structured pass/fail result — used by `runtime:package:validate` and by anything that wants to check a package without needing the loaded snapshot. */

export interface RuntimePackageValidationResult {
  readonly valid: boolean;
  readonly manifest?: RuntimePackageManifest;
  readonly error?: SafeRuntimePackageErrorJSON;
}

export async function validateRuntimePackage(dir: string, options?: LoadRuntimePackageOptions): Promise<RuntimePackageValidationResult> {
  try {
    const loaded = await loadRuntimePackage(dir, options);
    return { valid: true, manifest: loaded.manifest };
  } catch (error) {
    return { valid: false, error: toSafeRuntimePackageError(error) };
  }
}
