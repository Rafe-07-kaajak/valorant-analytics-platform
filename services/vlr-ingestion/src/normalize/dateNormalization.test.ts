import { describe, expect, it } from "vitest";
import { isWithinDateScope, normalizeTimestamp, parseEventDateRangeText, parseUtcTsAttribute } from "./dateNormalization";

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

describe("parseUtcTsAttribute — real VLR data-utc-ts markup (TASK-042 live verification)", () => {
  it("parses the epoch-seconds form seen on event bracket pages", () => {
    expect(parseUtcTsAttribute("1781370000")).toBe(new Date(1781370000 * 1000).toISOString());
  });

  it("parses the space-separated 'YYYY-MM-DD HH:MM:SS' form seen on the match header, treating it as UTC", () => {
    expect(parseUtcTsAttribute("2026-06-06 10:00:00")).toBe("2026-06-06T10:00:00.000Z");
  });

  it("returns undefined for an unrecognized form rather than guessing", () => {
    expect(parseUtcTsAttribute("not-a-timestamp")).toBeUndefined();
  });

  it("returns undefined for an empty/missing value", () => {
    expect(parseUtcTsAttribute(undefined)).toBeUndefined();
    expect(parseUtcTsAttribute("")).toBeUndefined();
  });
});

describe("parseEventDateRangeText — real VLR event-detail date range markup", () => {
  it("parses a cross-month range with an explicit year on both ends", () => {
    expect(parseEventDateRangeText("Jan 15 – Mar 1, 2025")).toEqual({ startDateIso: "2025-01-15T00:00:00.000Z", endDateIso: "2025-03-01T00:00:00.000Z" });
  });

  it("parses a same-month compact range (day only on the end)", () => {
    expect(parseEventDateRangeText("Jun 6–21, 2026")).toEqual({ startDateIso: "2026-06-06T00:00:00.000Z", endDateIso: "2026-06-21T00:00:00.000Z" });
  });

  it("returns nothing for the year-less discovery-listing form rather than guessing a year", () => {
    expect(parseEventDateRangeText("Jul 17—Sep 7")).toEqual({});
  });

  it("returns nothing for an unparseable string", () => {
    expect(parseEventDateRangeText("sometime soon")).toEqual({});
    expect(parseEventDateRangeText(undefined)).toEqual({});
  });
});
