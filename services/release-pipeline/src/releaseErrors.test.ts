import { describe, expect, it } from "vitest";
import { ReleaseError, isReleaseError, toSafeReleaseError } from "./releaseErrors";

describe("ReleaseError", () => {
  it("carries a stable code/retryable/exitCode and never leaks cause via toSafeJSON", () => {
    const cause = new Error("internal detail with a C:\\Users\\dev\\secret path");
    const error = new ReleaseError("release_hash_mismatch", "Hash mismatch.", { cause, details: { fileName: "x.json" } });
    const safe = error.toSafeJSON();
    expect(safe).toEqual({ code: "release_hash_mismatch", message: "Hash mismatch.", retryable: false, exitCode: 3, details: { fileName: "x.json" } });
    expect(JSON.stringify(safe)).not.toContain("secret");
  });

  it("isReleaseError narrows correctly", () => {
    expect(isReleaseError(new ReleaseError("release_bundle_missing", "x"))).toBe(true);
    expect(isReleaseError(new Error("x"))).toBe(false);
  });

  it("toSafeReleaseError maps an unknown thrown value to a safe generic error", () => {
    expect(toSafeReleaseError("a raw string throw")).toEqual({ code: "release_preflight_failed", message: "An unexpected internal error occurred.", retryable: false, exitCode: 1 });
  });

  it("toSafeReleaseError passes through a real ReleaseError's own code", () => {
    const safe = toSafeReleaseError(new ReleaseError("release_invalid_transition", "Bad transition."));
    expect(safe.code).toBe("release_invalid_transition");
  });
});
