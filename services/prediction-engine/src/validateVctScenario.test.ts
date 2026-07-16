import { describe, expect, it } from "vitest";
import type { PredictionRequest } from "@repo/shared";
import { validateVctScenario } from "./validateVctScenario";

function request(overrides: Partial<PredictionRequest["scenario"]> = {}): PredictionRequest {
  return {
    requestId: "r1",
    clientVersion: "web-0.1.0",
    timestamp: "2025-01-01T00:00:00.000Z",
    scenario: {
      teamAId: "paper-rex",
      teamBId: "g2-esports",
      seriesFormat: "BO3",
      mapIds: ["ascent", "haven", "bind"],
      ...overrides,
    },
  };
}

describe("validateVctScenario", () => {
  it("accepts a well-formed scenario using the 32-team roster", () => {
    expect(validateVctScenario(request())).toBeNull();
  });

  it("rejects identical teams", () => {
    expect(validateVctScenario(request({ teamAId: "paper-rex", teamBId: "paper-rex" }))).not.toBeNull();
  });

  it("rejects a team id from outside the VCT roster", () => {
    expect(validateVctScenario(request({ teamAId: "not-a-real-team" }))).not.toBeNull();
  });

  it("rejects an old 8-team-engine id (different roster, not interchangeable)", () => {
    expect(validateVctScenario(request({ teamAId: "sen" }))).not.toBeNull();
  });

  it("rejects an unsupported map", () => {
    expect(validateVctScenario(request({ mapIds: ["fracture"] }))).not.toBeNull();
  });

  it("rejects duplicate maps", () => {
    expect(validateVctScenario(request({ mapIds: ["ascent", "ascent"] }))).not.toBeNull();
  });

  it("rejects more maps than the series format allows", () => {
    expect(
      validateVctScenario(request({ seriesFormat: "BO3", mapIds: ["ascent", "haven", "bind", "lotus"] })),
    ).not.toBeNull();
  });

  it("allows exactly the series format's map limit", () => {
    expect(
      validateVctScenario(
        request({ seriesFormat: "BO5", mapIds: ["ascent", "haven", "bind", "lotus", "pearl"] }),
      ),
    ).toBeNull();
  });

  it("rejects an empty map selection", () => {
    expect(validateVctScenario(request({ mapIds: [] }))).not.toBeNull();
  });

  it("rejects a request with no scenario instead of throwing", () => {
    expect(validateVctScenario({ requestId: "r1" } as unknown as PredictionRequest)).not.toBeNull();
  });
});
