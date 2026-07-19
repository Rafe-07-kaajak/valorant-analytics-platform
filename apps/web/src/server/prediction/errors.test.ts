import { describe, expect, it } from "vitest";
import { InferenceError } from "@repo/model-inference";
import { PredictionApiError, isPredictionApiError, toPredictionApiError } from "./errors";

describe("PredictionApiError", () => {
  it("carries the fixed retryable flag and http status for its code", () => {
    const error = new PredictionApiError("historical_match_not_found", "not found");
    expect(error.retryable).toBe(false);
    expect(error.httpStatus).toBe(404);
  });

  it("toSafeJSON never includes a stack trace or extra fields beyond code/message/retryable/requestId", () => {
    const error = new PredictionApiError("model_unavailable", "unavailable");
    const json = error.toSafeJSON("req-1");
    expect(json).toEqual({ code: "model_unavailable", message: "unavailable", retryable: true, requestId: "req-1" });
    expect(Object.keys(json)).not.toContain("stack");
  });

  it("omits requestId when not provided", () => {
    const error = new PredictionApiError("request_invalid", "bad request");
    expect(error.toSafeJSON()).toEqual({ code: "request_invalid", message: "bad request", retryable: false });
  });
});

describe("toPredictionApiError", () => {
  it("passes through an existing PredictionApiError unchanged", () => {
    const original = new PredictionApiError("model_loading", "loading");
    expect(toPredictionApiError(original)).toBe(original);
  });

  it("maps model-not-loaded/model-unavailable InferenceError codes to model_unavailable", () => {
    expect(toPredictionApiError(new InferenceError("model_not_loaded", "x")).code).toBe("model_unavailable");
    expect(toPredictionApiError(new InferenceError("model_unavailable", "x")).code).toBe("model_unavailable");
  });

  it("maps artifact/infra InferenceError codes to model_unavailable without leaking the underlying detail", () => {
    for (const code of ["artifact_missing", "artifact_hash_mismatch", "artifact_schema_invalid", "unsupported_estimator", "unsupported_calibration", "unsafe_artifact_path", "payload_too_large"] as const) {
      const mapped = toPredictionApiError(new InferenceError(code, "internal detail that must not leak"));
      expect(mapped.code).toBe("model_unavailable");
      expect(mapped.message).not.toContain("internal detail");
    }
  });

  it("maps feature_schema_mismatch to feature_dataset_version_mismatch", () => {
    expect(toPredictionApiError(new InferenceError("feature_schema_mismatch", "x")).code).toBe("feature_dataset_version_mismatch");
  });

  it("maps field-level validation InferenceError codes to feature_row_invalid", () => {
    for (const code of ["missing_feature", "unknown_feature", "invalid_feature_type", "invalid_feature_value", "non_finite_feature"] as const) {
      expect(toPredictionApiError(new InferenceError(code, "x")).code).toBe("feature_row_invalid");
    }
  });

  it("maps requested_model_version_mismatch to model_version_mismatch", () => {
    expect(toPredictionApiError(new InferenceError("requested_model_version_mismatch", "x")).code).toBe("model_version_mismatch");
  });

  it("maps inference-failure InferenceError codes to inference_failed", () => {
    for (const code of ["inference_failed", "self_test_failed", "inference_timeout"] as const) {
      expect(toPredictionApiError(new InferenceError(code, "x")).code).toBe("inference_failed");
    }
  });

  it("maps an unknown thrown value to internal_error without leaking its message", () => {
    const mapped = toPredictionApiError(new Error("some raw internal error message"));
    expect(mapped.code).toBe("internal_error");
    expect(mapped.message).not.toContain("raw internal error message");
  });

  it("isPredictionApiError narrows correctly", () => {
    expect(isPredictionApiError(new PredictionApiError("internal_error", "x"))).toBe(true);
    expect(isPredictionApiError(new Error("x"))).toBe(false);
  });
});
