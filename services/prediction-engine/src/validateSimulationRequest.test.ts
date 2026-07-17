import { describe, expect, it } from "vitest";
import { createEmptyVctProfileAdjustment, type SimulationRequest } from "@repo/shared";
import { validateSimulationRequest } from "./validateSimulationRequest";

function request(overrides: Partial<SimulationRequest> = {}): SimulationRequest {
  return {
    requestId: "r1",
    clientVersion: "web-0.1.0",
    timestamp: "2025-01-01T00:00:00.000Z",
    scenario: { teamAId: "paper-rex", teamBId: "g2-esports", seriesFormat: "BO3", mapIds: ["ascent", "haven", "bind"] },
    teamAAdjustment: createEmptyVctProfileAdjustment(),
    teamBAdjustment: createEmptyVctProfileAdjustment(),
    ...overrides,
  };
}

describe("validateSimulationRequest", () => {
  it("accepts an empty (zero) adjustment payload", () => {
    expect(validateSimulationRequest(request())).toBeNull();
  });

  it("accepts a well-formed adjustment across scalar, dna, and mapStrength", () => {
    expect(
      validateSimulationRequest(
        request({
          teamAAdjustment: { scalar: { attackStrength: 5 }, dna: { aggression: -5 }, mapStrength: { ascent: 5 } },
        }),
      ),
    ).toBeNull();
  });

  it("rejects an invalid scenario before ever inspecting adjustments", () => {
    expect(validateSimulationRequest(request({ scenario: { teamAId: "paper-rex", teamBId: "paper-rex", seriesFormat: "BO3", mapIds: ["ascent"] } }))).not.toBeNull();
  });

  it("rejects an unsupported scalar field", () => {
    expect(
      validateSimulationRequest(request({ teamAAdjustment: { scalar: { overallRating: 5 } as never, dna: {}, mapStrength: {} } })),
    ).not.toBeNull();
  });

  it("rejects an unsupported dna field", () => {
    expect(
      validateSimulationRequest(request({ teamAAdjustment: { scalar: {}, dna: { notARealDimension: 5 } as never, mapStrength: {} } })),
    ).not.toBeNull();
  });

  it("rejects a non-numeric delta", () => {
    expect(
      validateSimulationRequest(request({ teamAAdjustment: { scalar: { attackStrength: "5" as never }, dna: {}, mapStrength: {} } })),
    ).not.toBeNull();
  });

  it("rejects NaN", () => {
    expect(
      validateSimulationRequest(request({ teamAAdjustment: { scalar: { attackStrength: NaN }, dna: {}, mapStrength: {} } })),
    ).not.toBeNull();
  });

  it("rejects Infinity", () => {
    expect(
      validateSimulationRequest(request({ teamAAdjustment: { scalar: { attackStrength: Infinity }, dna: {}, mapStrength: {} } })),
    ).not.toBeNull();
  });

  it("rejects a delta beyond the upper bound", () => {
    expect(
      validateSimulationRequest(request({ teamAAdjustment: { scalar: { attackStrength: 16 }, dna: {}, mapStrength: {} } })),
    ).not.toBeNull();
  });

  it("rejects a delta beyond the lower bound", () => {
    expect(
      validateSimulationRequest(request({ teamAAdjustment: { scalar: { attackStrength: -16 }, dna: {}, mapStrength: {} } })),
    ).not.toBeNull();
  });

  it("accepts a delta exactly at the bounds", () => {
    expect(
      validateSimulationRequest(request({ teamAAdjustment: { scalar: { attackStrength: 15 }, dna: { aggression: -15 }, mapStrength: {} } })),
    ).toBeNull();
  });

  it("rejects a map delta for a map not present in the scenario", () => {
    expect(
      validateSimulationRequest(request({ teamAAdjustment: { scalar: {}, dna: {}, mapStrength: { icebox: 5 } } })),
    ).not.toBeNull();
  });

  it("accepts a map delta for a map present in the scenario", () => {
    expect(
      validateSimulationRequest(request({ teamAAdjustment: { scalar: {}, dna: {}, mapStrength: { ascent: 5 } } })),
    ).toBeNull();
  });

  it("rejects an unsupported top-level key on the adjustment object", () => {
    expect(
      validateSimulationRequest(
        request({ teamAAdjustment: { scalar: {}, dna: {}, mapStrength: {}, extra: "nope" } as never }),
      ),
    ).not.toBeNull();
  });

  it("rejects a __proto__ key", () => {
    const malicious = JSON.parse('{"scalar": {"__proto__": 5}, "dna": {}, "mapStrength": {}}');
    expect(validateSimulationRequest(request({ teamAAdjustment: malicious }))).not.toBeNull();
  });

  it("rejects a constructor key", () => {
    expect(
      validateSimulationRequest(
        request({ teamAAdjustment: { scalar: { constructor: 5 } as never, dna: {}, mapStrength: {} } }),
      ),
    ).not.toBeNull();
  });

  it("rejects a non-object adjustment (string)", () => {
    expect(validateSimulationRequest(request({ teamAAdjustment: "not-an-object" as never }))).not.toBeNull();
  });

  it("rejects a non-object adjustment (array)", () => {
    expect(validateSimulationRequest(request({ teamAAdjustment: [] as never }))).not.toBeNull();
  });

  it("rejects a non-object adjustment (null)", () => {
    expect(validateSimulationRequest(request({ teamAAdjustment: null as never }))).not.toBeNull();
  });

  it("rejects an oversized delta map (more entries than valid fields)", () => {
    const bloated = { scalar: {}, dna: {}, mapStrength: {} as Record<string, number> };
    for (let i = 0; i < 50; i++) bloated.mapStrength[`map-${i}`] = 1;
    expect(validateSimulationRequest(request({ teamAAdjustment: bloated }))).not.toBeNull();
  });

  it("validates teamB's adjustment independently of teamA's", () => {
    expect(
      validateSimulationRequest(
        request({ teamBAdjustment: { scalar: { attackStrength: 100 }, dna: {}, mapStrength: {} } }),
      ),
    ).not.toBeNull();
  });
});
