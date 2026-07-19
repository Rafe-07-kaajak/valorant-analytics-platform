import { describe, expect, it } from "vitest";
import { InferenceError, toSafeError, isInferenceError } from "./errors";

describe("InferenceError", () => {
  it("maps a known code to a stable retryable flag and HTTP status", () => {
    const error = new InferenceError("model_not_loaded", "no model");
    expect(error.retryable).toBe(true);
    expect(error.httpStatus).toBe(503);
  });

  it("serializes to safe JSON without a stack trace or internal cause", () => {
    const cause = new Error("raw internal detail with a C:\\Users\\dev\\secret path");
    const error = new InferenceError("inference_failed", "safe message", { cause });
    const json = error.toSafeJSON();
    expect(json).toEqual({ code: "inference_failed", message: "safe message", retryable: false, httpStatus: 500 });
    expect(JSON.stringify(json)).not.toContain("C:\\Users");
    expect(JSON.stringify(json)).not.toContain("stack");
  });

  it("includes safe details when provided", () => {
    const error = new InferenceError("missing_feature", "missing", { details: { missing: ["a", "b"] } });
    expect(error.toSafeJSON().details).toEqual({ missing: ["a", "b"] });
  });
});

describe("toSafeError", () => {
  it("passes through an InferenceError's safe JSON", () => {
    const result = toSafeError(new InferenceError("payload_too_large", "too big"));
    expect(result.code).toBe("payload_too_large");
  });

  it("maps any unknown thrown value to a generic safe inference_failed error, never leaking its message", () => {
    const result = toSafeError(new Error("some raw internal stack detail"));
    expect(result.code).toBe("inference_failed");
    expect(result.message).not.toContain("raw internal stack detail");
  });
});

describe("isInferenceError", () => {
  it("distinguishes InferenceError from a plain Error", () => {
    expect(isInferenceError(new InferenceError("model_not_loaded", "x"))).toBe(true);
    expect(isInferenceError(new Error("x"))).toBe(false);
  });
});
