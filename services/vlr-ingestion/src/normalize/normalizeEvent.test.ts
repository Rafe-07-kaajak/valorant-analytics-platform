import { describe, expect, it } from "vitest";
import { deriveTournamentLevel, normalizeEvent } from "./normalizeEvent";
import type { VlrEvent } from "../vlr/schemas/raw";
import type { EventClassificationResult } from "../classification/eventFamily";

const RAW: VlrEvent = {
  vlrEventId: "2001",
  name: "VCT 2025: Americas Stage 1",
  status: "completed",
  startDateIso: "2025-01-15T00:00:00.000Z",
  endDateIso: "2025-03-01T00:00:00.000Z",
  region: "americas",
  eventUrl: "https://www.vlr.gg/event/2001",
  parentSeries: "Champions Tour",
  source: { sourceUrl: "https://www.vlr.gg/event/2001", fetchedAt: "2026-07-18T00:00:00.000Z", parserVersion: "vlr-parsers@1.0.0" },
};

const CLASSIFICATION: EventClassificationResult = {
  classification: "vct-americas",
  confidence: "high",
  reason: "test",
  evidence: [],
};

describe("deriveTournamentLevel", () => {
  it("maps Masters and Champions to international", () => {
    expect(deriveTournamentLevel("masters")).toBe("international");
    expect(deriveTournamentLevel("champions")).toBe("international");
  });

  it("maps the four VCT regions to league", () => {
    expect(deriveTournamentLevel("vct-emea")).toBe("league");
  });

  it("maps everything excluded or unknown to unknown", () => {
    expect(deriveTournamentLevel("excluded-tier-2")).toBe("unknown");
    expect(deriveTournamentLevel("unknown")).toBe("unknown");
  });
});

describe("normalizeEvent", () => {
  it("carries classification and derives tournament level", () => {
    const result = normalizeEvent(RAW, CLASSIFICATION, "2026-07-18T00:01:00.000Z");
    expect(result.eventFamily).toBe("vct-americas");
    expect(result.tournamentLevel).toBe("league");
    expect(result.classification.confidence).toBe("high");
  });

  it("normalizes structured start/end dates with high confidence", () => {
    const result = normalizeEvent(RAW, CLASSIFICATION, "2026-07-18T00:01:00.000Z");
    expect(result.startDate).toEqual({ iso: "2025-01-15T00:00:00.000Z", raw: "2025-01-15T00:00:00.000Z", confidence: "high" });
  });

  it("is idempotent for the same input", () => {
    const first = normalizeEvent(RAW, CLASSIFICATION, "t");
    const second = normalizeEvent(RAW, CLASSIFICATION, "t");
    expect(first).toEqual(second);
  });
});
