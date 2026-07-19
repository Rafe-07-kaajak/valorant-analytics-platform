import { describe, expect, it } from "vitest";
import type { NormalizedEvent } from "../normalize/normalizedSchemas";
import { EventCongestionRegistry, deriveEventContextFeatures } from "./eventContextState";

const DAY_MS = 86_400_000;

function buildEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    internalId: "vlr:event:1",
    name: "Test Event",
    status: "completed",
    startDate: { iso: "2025-01-01T00:00:00.000Z", raw: "r", confidence: "high" },
    endDate: { iso: "2025-01-10T00:00:00.000Z", raw: "r", confidence: "high" },
    tournamentLevel: "league",
    region: "americas",
    eventFamily: "vct-americas",
    classification: { classification: "vct-americas", confidence: "authoritative", reason: "r", evidence: [] },
    metadata: { provider: "vlr", providerExternalId: "1", sourceUrl: "https://www.vlr.gg/event/1", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h" },
    ...overrides,
  };
}

describe("deriveEventContextFeatures", () => {
  it("derives region/stage/season/month directly from the event and match timestamp", () => {
    const features = deriveEventContextFeatures(buildEvent({ stage: "Stage 1" }), "2025-03-15T00:00:00.000Z");
    expect(features.eventRegion).toBe("americas");
    expect(features.eventStage).toBe("Stage 1");
    expect(features.seasonYear).toBe(2025);
    expect(features.matchMonth).toBe(3);
    expect(features.isRegionalLeague).toBe(true);
    expect(features.isInternationalEvent).toBe(false);
    expect(features.isMastersOrChampions).toBe(false);
  });

  it("uses explicit 'unknown' when region/stage are absent, rather than guessing", () => {
    const event = buildEvent({ region: undefined, stage: undefined, tournamentLevel: "international", eventFamily: "masters" });
    const features = deriveEventContextFeatures(event, "2025-03-01T00:00:00.000Z");
    expect(features.eventRegion).toBe("unknown");
    expect(features.eventStage).toBe("unknown");
    expect(features.isInternationalEvent).toBe(true);
    expect(features.isMastersOrChampions).toBe(true);
  });

  it("recognizes champions as Masters/Champions too", () => {
    const features = deriveEventContextFeatures(buildEvent({ eventFamily: "champions", tournamentLevel: "international" }), "2025-09-01T00:00:00.000Z");
    expect(features.isMastersOrChampions).toBe(true);
  });
});

describe("EventCongestionRegistry", () => {
  it("counts zero matches for an event with no recorded history", () => {
    const registry = new EventCongestionRegistry();
    expect(registry.matchesInLast3Days("vlr:event:1", 0)).toBe(0);
  });

  it("counts only matches within the trailing 3-day window", () => {
    const registry = new EventCongestionRegistry();
    registry.recordMatch("vlr:event:1", 0);
    registry.recordMatch("vlr:event:1", 2 * DAY_MS);
    registry.recordMatch("vlr:event:1", 10 * DAY_MS);
    expect(registry.matchesInLast3Days("vlr:event:1", 3 * DAY_MS)).toBe(2);
  });

  it("never counts a match recorded for a different event", () => {
    const registry = new EventCongestionRegistry();
    registry.recordMatch("vlr:event:1", 0);
    expect(registry.matchesInLast3Days("vlr:event:2", DAY_MS)).toBe(0);
  });
});
