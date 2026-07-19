/**
 * Stable error taxonomy for the model inference service — TASK-046
 * requirement 10. Every code is machine-readable and mapped to an
 * HTTP-compatible status (for TASK-047+) and a retryable flag, so callers
 * never need to parse message text to decide how to react. Messages are
 * always safe to surface externally: no stack traces, no local filesystem
 * paths, no raw artifact content. The original `cause` (if any) is kept on
 * the instance for internal logging only and is never included by
 * `toSafeJSON()`.
 */

export type InferenceErrorCode =
  | "model_not_loaded"
  | "model_loading"
  | "model_unavailable"
  | "artifact_missing"
  | "artifact_hash_mismatch"
  | "artifact_schema_invalid"
  | "unsupported_estimator"
  | "unsupported_calibration"
  | "feature_schema_mismatch"
  | "missing_feature"
  | "unknown_feature"
  | "invalid_feature_type"
  | "invalid_feature_value"
  | "non_finite_feature"
  | "requested_model_version_mismatch"
  | "inference_failed"
  | "inference_timeout"
  | "self_test_failed"
  | "unsafe_artifact_path"
  | "payload_too_large";

interface ErrorPolicy {
  readonly retryable: boolean;
  readonly httpStatus: number;
}

const ERROR_POLICY: Readonly<Record<InferenceErrorCode, ErrorPolicy>> = {
  model_not_loaded: { retryable: true, httpStatus: 503 },
  model_loading: { retryable: true, httpStatus: 503 },
  model_unavailable: { retryable: true, httpStatus: 503 },
  artifact_missing: { retryable: false, httpStatus: 503 },
  artifact_hash_mismatch: { retryable: false, httpStatus: 500 },
  artifact_schema_invalid: { retryable: false, httpStatus: 500 },
  unsupported_estimator: { retryable: false, httpStatus: 500 },
  unsupported_calibration: { retryable: false, httpStatus: 500 },
  feature_schema_mismatch: { retryable: false, httpStatus: 400 },
  missing_feature: { retryable: false, httpStatus: 400 },
  unknown_feature: { retryable: false, httpStatus: 400 },
  invalid_feature_type: { retryable: false, httpStatus: 400 },
  invalid_feature_value: { retryable: false, httpStatus: 400 },
  non_finite_feature: { retryable: false, httpStatus: 400 },
  requested_model_version_mismatch: { retryable: false, httpStatus: 409 },
  inference_failed: { retryable: false, httpStatus: 500 },
  inference_timeout: { retryable: true, httpStatus: 504 },
  self_test_failed: { retryable: false, httpStatus: 500 },
  unsafe_artifact_path: { retryable: false, httpStatus: 400 },
  payload_too_large: { retryable: false, httpStatus: 413 },
};

export interface InferenceErrorDetails {
  readonly [key: string]: string | number | boolean | readonly string[] | undefined;
}

export interface SafeInferenceErrorJSON {
  readonly code: InferenceErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly httpStatus: number;
  readonly details?: InferenceErrorDetails;
}

export class InferenceError extends Error {
  readonly code: InferenceErrorCode;
  readonly retryable: boolean;
  readonly httpStatus: number;
  readonly details?: InferenceErrorDetails;
  /** Internal-only; never serialized by `toSafeJSON()`. */
  readonly cause2?: unknown;

  constructor(code: InferenceErrorCode, message: string, options?: { details?: InferenceErrorDetails; cause?: unknown }) {
    super(message);
    this.name = "InferenceError";
    this.code = code;
    this.retryable = ERROR_POLICY[code].retryable;
    this.httpStatus = ERROR_POLICY[code].httpStatus;
    this.details = options?.details;
    this.cause2 = options?.cause;
  }

  toSafeJSON(): SafeInferenceErrorJSON {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      httpStatus: this.httpStatus,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export function isInferenceError(value: unknown): value is InferenceError {
  return value instanceof InferenceError;
}

/** Maps any thrown value to a safe, stable-shape error for logging/CLI exit codes — never leaks a stack trace or raw message from an unknown error type. */
export function toSafeError(error: unknown): SafeInferenceErrorJSON {
  if (isInferenceError(error)) return error.toSafeJSON();
  return { code: "inference_failed", message: "An unexpected internal error occurred.", retryable: false, httpStatus: 500 };
}
