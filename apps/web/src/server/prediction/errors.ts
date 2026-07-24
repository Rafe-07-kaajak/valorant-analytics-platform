import { isInferenceError, type InferenceError } from "@repo/model-inference";
import type { PredictionApiErrorPayload, PredictionErrorCode } from "@repo/shared";

/**
 * Stable error taxonomy for TASK-047's backend prediction integration —
 * reuses TASK-046's `InferenceError` semantics where possible (see
 * `mapInferenceError` below) rather than inventing a parallel one. Every
 * code has a fixed `retryable` flag and HTTP status; `toSafeJSON()` never
 * includes a stack trace, a filesystem path, or the original `cause`.
 */

interface ErrorPolicy {
  readonly retryable: boolean;
  readonly httpStatus: number;
}

const ERROR_POLICY: Readonly<Record<PredictionErrorCode, ErrorPolicy>> = {
  model_unavailable: { retryable: true, httpStatus: 503 },
  model_loading: { retryable: true, httpStatus: 503 },
  historical_data_unavailable: { retryable: true, httpStatus: 503 },
  historical_match_not_found: { retryable: false, httpStatus: 404 },
  feature_dataset_version_mismatch: { retryable: false, httpStatus: 409 },
  feature_row_invalid: { retryable: false, httpStatus: 500 },
  model_version_mismatch: { retryable: false, httpStatus: 409 },
  inference_validation_failed: { retryable: false, httpStatus: 400 },
  inference_failed: { retryable: false, httpStatus: 500 },
  request_invalid: { retryable: false, httpStatus: 400 },
  internal_error: { retryable: false, httpStatus: 500 },
  // TASK-048: runtime-package source-mode errors. `_missing` is retryable
  // (an operator hasn't built/mounted the package yet, and it may appear
  // later); every other code indicates a packaging/config defect an
  // operator must fix, not a condition that resolves itself on retry.
  runtime_package_missing: { retryable: true, httpStatus: 503 },
  runtime_package_manifest_invalid: { retryable: false, httpStatus: 500 },
  runtime_package_hash_mismatch: { retryable: false, httpStatus: 500 },
  runtime_package_version_mismatch: { retryable: false, httpStatus: 409 },
  runtime_package_model_mismatch: { retryable: false, httpStatus: 409 },
  runtime_package_feature_mismatch: { retryable: false, httpStatus: 409 },
  runtime_package_row_count_mismatch: { retryable: false, httpStatus: 500 },
  runtime_package_unsafe_path: { retryable: false, httpStatus: 400 },
  runtime_package_unsupported_target: { retryable: false, httpStatus: 500 },
  // Real-model integration: the raw curated dataset (matches.json/events.json)
  // needed to construct a current-matchup feature row is not available locally.
  current_matchup_data_unavailable: { retryable: true, httpStatus: 503 },
};

export class PredictionApiError extends Error {
  readonly code: PredictionErrorCode;
  readonly retryable: boolean;
  readonly httpStatus: number;

  constructor(code: PredictionErrorCode, message: string) {
    super(message);
    this.name = "PredictionApiError";
    this.code = code;
    this.retryable = ERROR_POLICY[code].retryable;
    this.httpStatus = ERROR_POLICY[code].httpStatus;
  }

  toSafeJSON(requestId?: string): PredictionApiErrorPayload {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(requestId ? { requestId } : {}),
    };
  }
}

export function isPredictionApiError(value: unknown): value is PredictionApiError {
  return value instanceof PredictionApiError;
}

/**
 * Maps a TASK-046 `InferenceError` onto this task's own browser-safe code
 * taxonomy. Every case below can only occur here because *this service's
 * own server-side code* built the inference request from a stored feature
 * row (never directly from browser input), so field-level validation
 * failures (`missing_feature`, `invalid_feature_type`, etc.) indicate a
 * malformed stored row, not a caller mistake — they are reported as
 * `feature_row_invalid` rather than surfacing the underlying field name to
 * the browser.
 */
function mapInferenceError(error: InferenceError): PredictionApiError {
  switch (error.code) {
    case "model_not_loaded":
    case "model_unavailable":
      return new PredictionApiError("model_unavailable", "The prediction model is not currently available.");
    case "model_loading":
      return new PredictionApiError("model_loading", "The prediction model is still loading. Try again shortly.");
    case "artifact_missing":
    case "artifact_hash_mismatch":
    case "artifact_schema_invalid":
    case "unsupported_estimator":
    case "unsupported_calibration":
    case "unsafe_artifact_path":
    case "payload_too_large":
      return new PredictionApiError("model_unavailable", "The prediction model is not currently available.");
    case "feature_schema_mismatch":
      return new PredictionApiError("feature_dataset_version_mismatch", "The historical feature dataset does not match the currently loaded model's expected schema.");
    case "missing_feature":
    case "unknown_feature":
    case "invalid_feature_type":
    case "invalid_feature_value":
    case "non_finite_feature":
      return new PredictionApiError("feature_row_invalid", "The stored historical feature row is invalid for the currently loaded model.");
    case "requested_model_version_mismatch":
      return new PredictionApiError("model_version_mismatch", "The requested model version does not match the currently loaded model.");
    case "inference_failed":
    case "self_test_failed":
    case "inference_timeout":
      return new PredictionApiError("inference_failed", "Unable to generate a prediction for this match.");
    default:
      return new PredictionApiError("internal_error", "An unexpected internal error occurred.");
  }
}

/** Converts any thrown value into a `PredictionApiError` — never leaks an unknown error's raw message. */
export function toPredictionApiError(error: unknown): PredictionApiError {
  if (isPredictionApiError(error)) return error;
  if (isInferenceError(error)) return mapInferenceError(error);
  return new PredictionApiError("internal_error", "An unexpected internal error occurred.");
}
