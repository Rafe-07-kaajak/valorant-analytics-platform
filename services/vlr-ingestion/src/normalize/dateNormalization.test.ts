import { describe, expect, it } from "vitest";
import { isWithinDateScope, normalizeTimestamp } from "./dateNormalization";

describe("normalizeTimestamp", () => {
  it("normalizes a Zulu-suffixed timestamp with high confidence", () => {
    const result = normalizeTimestamp("Jan 15, 2025 6:00 PM", "2025-01-15T18:00:00.000Z");
    expect(result).toEqual({ iso: "2025-01-15T18:00:00.000Z", raw: "Jan 15, 2025 6:00 PM", confidence: "high" });
  });

  it("normalizes a timestamp with an explicit numeric offset", () => {
    const result = normalizeTimestamp(undefined, "2025-01-15T13:00:00-05:00");
    expect(result.confidence).toBe("high");
    expect(result.iso).toBe("2025-01-15T18:00:00.000Z");
  });

  it("refuses to normalize a bare date with no offset (ambiguous timezone)", () => {
    const result = normalizeTimestamp("Jan 15, 2025", "2025-01-15");
    expect(result.iso).toBeNull();
    expect(result.confidence).toBe("none");
    expect(result.raw).toBe("Jan 15, 2025");
  });

  it("never uses the local machine timezone to fill a missing offset", () => {
    const result = normalizeTimestamp("some display string", undefined);
    expect(result.iso).toBeNull();
  });

  it("handles a day-boundary timestamp correctly", () => {
    const result = normalizeTimestamp(undefined, "2025-01-01T00:00:00.000Z");
    expect(result.iso).toBe("2025-01-01T00:00:00.000Z");
  });

  it("handles the last instant of a day correctly", () => {
    const result = normalizeTimestamp(undefined, "2025-12-31T23:59:59.999Z");
    expect(result.iso).toBe("2025-12-31T23:59:59.999Z");
  });
});

describe("isWithinDateScope", () => {
  it("includes the exact start-of-day boundary", () => {
    expect(isWithinDateScope("2025-01-01T00:00:00.000Z", "2025-01-01", "2025-12-31")).toBe(true);
  });

  it("includes the exact end-of-day boundary", () => {
    expect(isWithinDateScope("2025-12-31T23:59:59.999Z", "2025-01-01", "2025-12-31")).toBe(true);
  });

  it("excludes a timestamp one millisecond before the scope starts", () => {
    expect(isWithinDateScope("2024-12-31T23:59:59.999Z", "2025-01-01", "2025-12-31")).toBe(false);
  });

  it("excludes a timestamp one day after the scope ends", () => {
    expect(isWithinDateScope("2026-01-01T00:00:00.000Z", "2025-01-01", "2025-12-31")).toBe(false);
  });
});
