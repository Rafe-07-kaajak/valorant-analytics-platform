import { describe, expect, it } from "vitest";
import { auditMatchTimestamp } from "./timestampHardening";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";
import type { NormalizedEvent } from "../normalize/normalizedSchemas";

function buildEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    internalId: "vlr:event:1",
    name: "Test Event",
    status: "completed",
    startDate: { iso: "2025-05-01T00:00:00.000Z", raw: "r", confidence: "high" },
    endDate: { iso: "2025-06-01T00:00:00.000Z", raw: "r", confidence: "high" },
    tournamentLevel: "league",
    eventFamily: "vct-americas",
    classification: { classification: "vct-americas", confidence: "high", reason: "r", evidence: [] },
    metadata: { provider: "vlr", providerExternalId: "1", sourceUrl: "u", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h" },
    ...overrides,
  };
}

describe("auditMatchTimestamp", () => {
  it("raises no issues for a match within both its event's range and the approved scope", () => {
    expect(auditMatchTimestamp(buildNormalizedMatch(), buildEvent(), "2025-01-01", "2026-12-31", "t")).toHaveLength(0);
  });

  it("flags a missing timestamp", () => {
    const match = buildNormalizedMatch({ scheduledAt: { iso: null, raw: undefined, confidence: "none" } });
    const issues = auditMatchTimestamp(match, buildEvent(), "2025-01-01", "2026-12-31", "t");
    expect(issues).toEqual([expect.objectContaining({ code: "missing_timestamp" })]);
  });

  it("flags an ambiguous (unnormalizable) raw timestamp distinctly from a fully missing one", () => {
    const match = buildNormalizedMatch({ scheduledAt: { iso: null, raw: "Some ambiguous display text", confidence: "none" } });
    const issues = auditMatchTimestamp(match, buildEvent(), "2025-01-01", "2026-12-31", "t");
    expect(issues).toEqual([expect.objectContaining({ code: "ambiguous_timestamp" })]);
  });

  it("flags a match scheduled outside the approved dataset scope", () => {
    const match = buildNormalizedMatch({ scheduledAt: { iso: "2024-01-01T00:00:00.000Z", raw: "r", confidence: "high" } });
    const issues = auditMatchTimestamp(match, null, "2025-01-01", "2026-12-31", "t");
    expect(issues.some((i) => i.code === "outside_date_scope")).toBe(true);
  });

  it("flags a match scheduled outside its own parent event's date range", () => {
    const match = buildNormalizedMatch({ scheduledAt: { iso: "2025-07-15T00:00:00.000Z", raw: "r", confidence: "high" } });
    const issues = auditMatchTimestamp(match, buildEvent(), "2025-01-01", "2026-12-31", "t");
    expect(issues.some((i) => i.code === "outside_date_scope")).toBe(true);
  });

  it("does not cross-check against an event when none is provided (orphaned match)", () => {
    const match = buildNormalizedMatch();
    expect(auditMatchTimestamp(match, null, "2025-01-01", "2026-12-31", "t")).toHaveLength(0);
  });
});
