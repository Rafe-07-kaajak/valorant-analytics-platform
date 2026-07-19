import { describe, expect, it } from "vitest";
import { buildNormalizedMatch } from "../testUtils/normalizedMatchFixture";
import type { NormalizedEvent } from "../normalize/normalizedSchemas";
import { buildFeatureFeasibilityAudit } from "./featureAudit";

function buildEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    internalId: "vlr:event:1",
    name: "Test Event",
    status: "completed",
    startDate: { iso: "2025-01-01T00:00:00.000Z", raw: "raw", confidence: "high" },
    endDate: { iso: "2025-01-10T00:00:00.000Z", raw: "raw", confidence: "high" },
    tournamentLevel: "league",
    region: "americas",
    eventFamily: "vct-americas",
    classification: { classification: "vct-americas", confidence: "authoritative", reason: "r", evidence: [] },
    metadata: { provider: "vlr", providerExternalId: "1", sourceUrl: "https://www.vlr.gg/event/1", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h" },
    ...overrides,
  };
}

describe("buildFeatureFeasibilityAudit", () => {
  it("reports one entry per candidate signal with a defined include/exclude decision", () => {
    const audit = buildFeatureFeasibilityAudit([buildNormalizedMatch()], [buildEvent()], "2026-01-01T00:00:00.000Z");
    expect(audit.entries.length).toBeGreaterThan(0);
    for (const entry of audit.entries) {
      expect(typeof entry.includedInTask044).toBe("boolean");
      expect(["none", "high", "mitigated"]).toContain(entry.leakageRisk);
    }
  });

  it("explicitly excludes map-veto and team home-region signals with a documented reason", () => {
    const audit = buildFeatureFeasibilityAudit([buildNormalizedMatch()], [buildEvent()], "2026-01-01T00:00:00.000Z");
    const veto = audit.entries.find((e) => e.signal.includes("veto"));
    const region = audit.entries.find((e) => e.signal.includes("home-region"));
    expect(veto?.includedInTask044).toBe(false);
    expect(region?.includedInTask044).toBe(false);
    expect(veto?.notes.length).toBeGreaterThan(0);
    expect(region?.notes.length).toBeGreaterThan(0);
  });

  it("computes real coverage counts from the provided dataset rather than static placeholders", () => {
    const withoutRoster = buildNormalizedMatch({ internalId: "vlr:match:2", rosterSnapshots: [], metadata: { provider: "vlr", providerExternalId: "2", sourceUrl: "u", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h2" } });
    const withRoster = buildNormalizedMatch();
    const audit = buildFeatureFeasibilityAudit([withRoster, withoutRoster], [buildEvent()], "2026-01-01T00:00:00.000Z");
    const rosterEntry = audit.entries.find((e) => e.signal.startsWith("Roster continuity"))!;
    expect(rosterEntry.coverageCount).toBe(1);
    expect(rosterEntry.coverageDenominator).toBe(2);
    expect(rosterEntry.missingnessRate).toBeCloseTo(0.5);
  });
});
