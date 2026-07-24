import { describe, expect, it } from "vitest";
import { buildCuratedMatch } from "../testUtils/curatedMatchFixture";
import type { NormalizedEvent } from "../normalize/normalizedSchemas";
import { deriveCanonicalWindow, isEligibleForCanonicalWindow } from "./canonicalWindow";

function buildEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    internalId: "vlr:event:2282",
    name: "Valorant Masters Toronto 2025",
    status: "completed",
    startDate: { iso: "2025-06-07T00:00:00.000Z", raw: "raw", confidence: "high" },
    endDate: { iso: "2025-06-22T00:00:00.000Z", raw: "raw", confidence: "high" },
    tournamentLevel: "international",
    eventFamily: "masters",
    classification: { classification: "masters", confidence: "high", reason: "test", evidence: [] },
    metadata: { provider: "vlr", providerExternalId: "2282", sourceUrl: "https://www.vlr.gg/event/2282", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "hash" },
    ...overrides,
  };
}

describe("deriveCanonicalWindow", () => {
  it("throws when the anchor event isn't found", () => {
    expect(() => deriveCanonicalWindow([], [])).toThrow(/not found/);
  });

  it("throws when the anchor event has no curated matches", () => {
    expect(() => deriveCanonicalWindow([buildEvent()], [])).toThrow(/no curated matches/);
  });

  it("derives the window start as the true minimum scheduledAt among the event's matches, regardless of input order", () => {
    const event = buildEvent();
    const matches = [
      buildCuratedMatch({ eventId: event.internalId, scheduledAt: { iso: "2025-06-10T12:00:00.000Z", raw: "raw", confidence: "high" } }),
      buildCuratedMatch({ eventId: event.internalId, internalId: "vlr:match:2", scheduledAt: { iso: "2025-06-07T12:00:00.000Z", raw: "raw", confidence: "high" } }),
      buildCuratedMatch({ eventId: event.internalId, internalId: "vlr:match:3", scheduledAt: { iso: "2025-06-15T12:00:00.000Z", raw: "raw", confidence: "high" } }),
    ];

    const window = deriveCanonicalWindow([event], matches);
    expect(window.windowStartIso).toBe("2025-06-07T12:00:00.000Z");
    expect(window.sourceEventInternalId).toBe("vlr:event:2282");
    expect(window.sourceEventName).toBe("Valorant Masters Toronto 2025");
  });

  it("ignores matches belonging to a different event", () => {
    const event = buildEvent();
    const matches = [
      buildCuratedMatch({ eventId: event.internalId, scheduledAt: { iso: "2025-06-10T00:00:00.000Z", raw: "raw", confidence: "high" } }),
      buildCuratedMatch({ eventId: "vlr:event:9999", internalId: "vlr:match:2", scheduledAt: { iso: "2020-01-01T00:00:00.000Z", raw: "raw", confidence: "high" } }),
    ];

    const window = deriveCanonicalWindow([event], matches);
    expect(window.windowStartIso).toBe("2025-06-10T00:00:00.000Z");
  });
});

describe("isEligibleForCanonicalWindow", () => {
  const window = { windowStartIso: "2025-06-07T12:00:00.000Z", sourceEventInternalId: "vlr:event:2282", sourceEventName: "Valorant Masters Toronto 2025" };

  it("is eligible when strictly after the window start", () => {
    expect(isEligibleForCanonicalWindow("2025-06-08T00:00:00.000Z", window)).toBe(true);
  });

  it("is eligible when exactly equal to the window start (inclusive boundary)", () => {
    expect(isEligibleForCanonicalWindow("2025-06-07T12:00:00.000Z", window)).toBe(true);
  });

  it("is not eligible when strictly before the window start", () => {
    expect(isEligibleForCanonicalWindow("2025-06-07T11:59:59.000Z", window)).toBe(false);
  });
});
