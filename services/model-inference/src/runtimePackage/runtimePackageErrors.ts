/**
 * Stable error taxonomy for TASK-048's runtime packaging build/load/validate
 * pipeline. Deliberately a separate class from `InferenceError` (which is
 * about *model inference* concerns) — packaging/loading a runtime package is
 * a distinct concern (file integrity, version agreement across two source
 * artifacts) and conflating the two taxonomies would blur that boundary.
 * `apps/web`'s `errors.ts` maps this class's `code` onto its own
 * browser-safe `PredictionErrorCode` (`runtime_package_*` entries), the same
 * way it already maps `InferenceErrorCode` via `mapInferenceError`.
 */

export type RuntimePackageErrorCode =
  | "runtime_package_missing"
  | "runtime_package_manifest_invalid"
  | "runtime_package_hash_mismatch"
  | "runtime_package_version_mismatch"
  | "runtime_package_model_mismatch"
  | "runtime_package_feature_mismatch"
  | "runtime_package_row_count_mismatch"
  | "runtime_package_unsafe_path"
  | "runtime_package_unsupported_target"
  | "runtime_package_build_failed";

export interface RuntimePackageErrorDetails {
  readonly [key: string]: string | number | boolean | readonly string[] | undefined;
}

export interface SafeRuntimePackageErrorJSON {
  readonly code: RuntimePackageErrorCode;
  readonly message: string;
  readonly details?: RuntimePackageErrorDetails;
}

export class RuntimePackageError extends Error {
  readonly code: RuntimePackageErrorCode;
  readonly details?: RuntimePackageErrorDetails;

  constructor(code: RuntimePackageErrorCode, message: string, options?: { details?: RuntimePackageErrorDetails }) {
    super(message);
    this.name = "RuntimePackageError";
    this.code = code;
    this.details = options?.details;
  }

  toSafeJSON(): SafeRuntimePackageErrorJSON {
    return { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) };
  }
}

export function isRuntimePackageError(value: unknown): value is RuntimePackageError {
  return value instanceof RuntimePackageError;
}

export function toSafeRuntimePackageError(error: unknown): SafeRuntimePackageErrorJSON {
  if (isRuntimePackageError(error)) return error.toSafeJSON();
  return { code: "runtime_package_build_failed", message: "An unexpected internal error occurred while processing the runtime package." };
}
