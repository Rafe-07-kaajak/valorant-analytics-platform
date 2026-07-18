import { describe, expect, it } from "vitest";
import { buildCanonicalTargetScope, serializeBackfillScope, validateBackfillScope } from "./backfillScope";
import type { BackfillScope } from "./backfillScope";

function validScope(overrides: Partial<BackfillScope> = {}): BackfillScope {
  return { ...buildCanonicalTargetScope(new Date("2026-07-18T00:00:00.000Z")), ...overrides };
}

describe("buildCanonicalTargetScope", () => {
  it("starts at 2025-01-01", () => {
    expect(buildCanonicalTargetScope(new Date("2026-07-18T00:00:00.000Z")).startDate).toBe("2025-01-01");
  });

  it("ends at the provided as-of date", () => {
    expect(buildCanonicalTargetScope(new Date("2026-07-18T00:00:00.000Z")).endDate).toBe("2026-07-18");
  });

  it("includes exactly the six approved event families", () => {
    const scope = buildCanonicalTargetScope();
    expect(new Set(scope.eventFamilies)).toEqual(
      new Set(["vct-americas", "vct-emea", "vct-pacific", "vct-china", "masters", "champions"]),
    );
  });

  it("restricts to completed matches only", () => {
    const scope = buildCanonicalTargetScope();
    expect(scope.completedOnly).toBe(true);
    expect(scope.matchStatus).toEqual(["completed"]);
  });

  it("is valid according to validateBackfillScope", () => {
    expect(validateBackfillScope(buildCanonicalTargetScope()).valid).toBe(true);
  });

  it("extends past the current date without redesigning the scope shape", () => {
    const future = buildCanonicalTargetScope(new Date("2027-03-01T00:00:00.000Z"));
    expect(future.endDate).toBe("2027-03-01");
    expect(validateBackfillScope(future).valid).toBe(true);
  });
});

describe("validateBackfillScope", () => {
  it("rejects a malformed startDate", () => {
    const result = validateBackfillScope(validScope({ startDate: "01-01-2025" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("startDate"))).toBe(true);
  });

  it("rejects startDate after endDate", () => {
    const result = validateBackfillScope(validScope({ startDate: "2026-01-01", endDate: "2025-01-01" }));
    expect(result.valid).toBe(false);
  });

  it("rejects an empty eventFamilies list", () => {
    const result = validateBackfillScope(validScope({ eventFamilies: [] }));
    expect(result.valid).toBe(false);
  });

  it("rejects an unapproved event family", () => {
    const result = validateBackfillScope(validScope({ eventFamilies: ["vct-korea" as never] }));
    expect(result.valid).toBe(false);
  });

  it("rejects overlapping includeEventIds and excludeEventIds", () => {
    const result = validateBackfillScope(validScope({ includeEventIds: ["1"], excludeEventIds: ["1"] }));
    expect(result.valid).toBe(false);
  });

  it("rejects completedOnly=true without \"completed\" in matchStatus", () => {
    const result = validateBackfillScope(validScope({ completedOnly: true, matchStatus: ["scheduled"] }));
    expect(result.valid).toBe(false);
  });

  it("rejects maximumEvents beyond the safe ceiling", () => {
    const result = validateBackfillScope(validScope({ maximumEvents: 1_000_000 }));
    expect(result.valid).toBe(false);
  });

  it("rejects a non-positive maximumMatches", () => {
    const result = validateBackfillScope(validScope({ maximumMatches: 0 }));
    expect(result.valid).toBe(false);
  });

  it("accepts a resumeCheckpoint alongside an otherwise-valid scope", () => {
    const result = validateBackfillScope(validScope({ resumeCheckpoint: "checkpoint-1" }));
    expect(result.valid).toBe(true);
  });
});

describe("serializeBackfillScope", () => {
  it("produces identical output regardless of array construction order", () => {
    const a = validScope({ eventFamilies: ["masters", "champions", "vct-americas", "vct-emea", "vct-pacific", "vct-china"] });
    const b = validScope({ eventFamilies: ["vct-china", "vct-pacific", "vct-emea", "vct-americas", "champions", "masters"] });
    expect(serializeBackfillScope(a)).toBe(serializeBackfillScope(b));
  });

  it("produces different output for genuinely different scopes", () => {
    const a = validScope({ endDate: "2026-01-01" });
    const b = validScope({ endDate: "2026-02-01" });
    expect(serializeBackfillScope(a)).not.toBe(serializeBackfillScope(b));
  });

  it("is stable across repeated calls with the same input", () => {
    const scope = validScope();
    expect(serializeBackfillScope(scope)).toBe(serializeBackfillScope(scope));
  });
});
