/**
 * Stable error taxonomy for the release pipeline — TASK-049. Every code is
 * machine-readable and mapped to a retryable flag and an exit code, so CLI
 * callers never need to parse message text. Messages are always safe to
 * print: no stack traces, no local filesystem paths, no environment values.
 * The original `cause` (if any) is retained on the instance for internal
 * logging only and is never included by `toSafeJSON()`. Mirrors
 * `services/model-inference/src/errors.ts` exactly.
 */

export type ReleaseErrorCode =
  | "release_source_dirty"
  | "release_commit_unavailable"
  | "release_runtime_package_missing"
  | "release_runtime_package_invalid"
  | "release_application_build_missing"
  | "release_application_build_invalid"
  | "release_manifest_invalid"
  | "release_hash_mismatch"
  | "release_version_mismatch"
  | "release_config_invalid"
  | "release_forbidden_file"
  | "release_unsafe_path"
  | "release_symlink_rejected"
  | "release_secret_detected"
  | "release_target_unsupported"
  | "release_preflight_failed"
  | "release_smoke_failed"
  | "release_invalid_transition"
  | "release_bundle_missing";

interface ErrorPolicy {
  readonly retryable: boolean;
  readonly exitCode: number;
}

const ERROR_POLICY: Readonly<Record<ReleaseErrorCode, ErrorPolicy>> = {
  release_source_dirty: { retryable: true, exitCode: 2 },
  release_commit_unavailable: { retryable: true, exitCode: 2 },
  release_runtime_package_missing: { retryable: true, exitCode: 2 },
  release_runtime_package_invalid: { retryable: false, exitCode: 3 },
  release_application_build_missing: { retryable: true, exitCode: 2 },
  release_application_build_invalid: { retryable: false, exitCode: 3 },
  release_manifest_invalid: { retryable: false, exitCode: 3 },
  release_hash_mismatch: { retryable: false, exitCode: 3 },
  release_version_mismatch: { retryable: false, exitCode: 3 },
  release_config_invalid: { retryable: false, exitCode: 3 },
  release_forbidden_file: { retryable: false, exitCode: 4 },
  release_unsafe_path: { retryable: false, exitCode: 4 },
  release_symlink_rejected: { retryable: false, exitCode: 4 },
  release_secret_detected: { retryable: false, exitCode: 4 },
  release_target_unsupported: { retryable: false, exitCode: 5 },
  release_preflight_failed: { retryable: true, exitCode: 6 },
  release_smoke_failed: { retryable: true, exitCode: 6 },
  release_invalid_transition: { retryable: false, exitCode: 7 },
  release_bundle_missing: { retryable: true, exitCode: 2 },
};

export interface ReleaseErrorDetails {
  readonly [key: string]: string | number | boolean | readonly string[] | undefined;
}

export interface SafeReleaseErrorJSON {
  readonly code: ReleaseErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly exitCode: number;
  readonly details?: ReleaseErrorDetails;
}

export class ReleaseError extends Error {
  readonly code: ReleaseErrorCode;
  readonly retryable: boolean;
  readonly exitCode: number;
  readonly details?: ReleaseErrorDetails;
  /** Internal-only; never serialized by `toSafeJSON()`. */
  readonly cause2?: unknown;

  constructor(code: ReleaseErrorCode, message: string, options?: { details?: ReleaseErrorDetails; cause?: unknown }) {
    super(message);
    this.name = "ReleaseError";
    this.code = code;
    this.retryable = ERROR_POLICY[code].retryable;
    this.exitCode = ERROR_POLICY[code].exitCode;
    this.details = options?.details;
    this.cause2 = options?.cause;
  }

  toSafeJSON(): SafeReleaseErrorJSON {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      exitCode: this.exitCode,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export function isReleaseError(value: unknown): value is ReleaseError {
  return value instanceof ReleaseError;
}

/** Maps any thrown value to a safe, stable-shape error for logging/CLI exit codes — never leaks a stack trace or raw message from an unknown error type. */
export function toSafeReleaseError(error: unknown): SafeReleaseErrorJSON {
  if (isReleaseError(error)) return error.toSafeJSON();
  return { code: "release_preflight_failed", message: "An unexpected internal error occurred.", retryable: false, exitCode: 1 };
}
