import { describe, expect, it } from "vitest";
import type { PredictionRequest } from "@repo/shared";
import { validateScenario } from "./validateScenario";

function request(overrides: Partial<PredictionRequest["scenario"]> = {}): PredictionRequest {
  return {
    requestId: "r1",
    clientVersion: "web-0.1.0",
    timestamp: "2025-01-01T00:00:00.000Z",
    scenario: {
      teamAId: "sen",
      teamBId: "loud",
      seriesFormat: "BO3",
      mapIds: ["ascent", "haven", "bind"],
      ...overrides,
    },
  };
}

describe("validateScenario", () => {
  it("accepts a well-formed scenario", () => {
    expect(validateScenario(request())).toBeNull();
  });

  it("rejects identical teams", () => {
    expect(validateScenario(request({ teamAId: "sen", teamBId: "sen" }))).not.toBeNull();
  });

  it("rejects an unknown team", () => {
    expect(validateScenario(request({ teamAId: "not-real" }))).not.toBeNull();
  });

  it("rejects an unsupported map", () => {
    expect(validateScenario(request({ mapIds: ["fracture"] }))).not.toBeNull();
  });

  it("rejects duplicate maps", () => {
    expect(validateScenario(request({ mapIds: ["ascent", "ascent"] }))).not.toBeNull();
  });

  it("rejects more maps than the series format allows", () => {
    expect(
      validateScenario(request({ seriesFormat: "BO3", mapIds: ["ascent", "haven", "bind", "lotus"] })),
    ).not.toBeNull();
  });

  it("allows exactly the series format's map limit", () => {
    expect(
      validateScenario(
        request({ seriesFormat: "BO5", mapIds: ["ascent", "haven", "bind", "lotus", "pearl"] }),
      ),
    ).toBeNull();
  });

  it("rejects an empty map selection", () => {
    expect(validateScenario(request({ mapIds: [] }))).not.toBeNull();
  });

  it("rejects a request with no scenario instead of throwing", () => {
    expect(validateScenario({ requestId: "r1" } as unknown as PredictionRequest)).not.toBeNull();
  });

  it("rejects a request missing clientVersion", () => {
    const { scenario, timestamp } = request();
    expect(
      validateScenario({ requestId: "r1", timestamp, scenario } as unknown as PredictionRequest),
    ).not.toBeNull();
  });

  it("rejects a request missing timestamp", () => {
    const { scenario, clientVersion } = request();
    expect(
      validateScenario({ requestId: "r1", clientVersion, scenario } as unknown as PredictionRequest),
    ).not.toBeNull();
  });
});
