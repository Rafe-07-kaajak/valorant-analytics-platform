import { describe, expect, it } from "vitest";
import { createEmptyVctProfileAdjustment, type SimulationRequest, type Team, type VctProfileAdjustment } from "@repo/shared";
import { simulateVctPrediction } from "./simulateVctPrediction";
import { generateVctPrediction } from "./generateVctPrediction";
import { VCT_TEAM_PROFILES } from "./lib/vctTeamProfiles";

function team(id: string, region: string): Team {
  return { id, name: id, region, logoUrl: `/assets/vct/teams/${region}/${id}.png` };
}

function request(
  teamAId: string,
  teamBId: string,
  teamAAdjustment: VctProfileAdjustment = createEmptyVctProfileAdjustment(),
  teamBAdjustment: VctProfileAdjustment = createEmptyVctProfileAdjustment(),
  mapIds: string[] = ["ascent", "haven", "bind"],
): SimulationRequest {
  return {
    requestId: crypto.randomUUID(),
    clientVersion: "web-0.1.0",
    timestamp: new Date().toISOString(),
    scenario: { teamAId, teamBId, seriesFormat: "BO3", mapIds },
    teamAAdjustment,
    teamBAdjustment,
  };
}

const paperRex = team("paper-rex", "pacific");
const g2 = team("g2-esports", "americas");

describe("simulateVctPrediction", () => {
  it("with zero adjustments, produces the same analytical fields as the baseline prediction", () => {
    // Distinct map combo so this doesn't collide with generateVctPrediction's own cache from other test files.
    const mapIds = ["lotus", "pearl", "split"];
    const baseline = generateVctPrediction(
      { requestId: "r-baseline", clientVersion: "web-0.1.0", timestamp: new Date().toISOString(), scenario: { teamAId: "paper-rex", teamBId: "g2-esports", seriesFormat: "BO3", mapIds } },
      paperRex,
      g2,
    );
    const simulated = simulateVctPrediction(
      request("paper-rex", "g2-esports", createEmptyVctProfileAdjustment(), createEmptyVctProfileAdjustment(), mapIds),
      paperRex,
      g2,
      createEmptyVctProfileAdjustment(),
      createEmptyVctProfileAdjustment(),
    );

    expect(simulated.outcomes).toEqual(baseline.outcomes);
    expect(simulated.predictedWinnerId).toBe(baseline.predictedWinnerId);
    expect(simulated.confidence).toBe(baseline.confidence);
    expect(simulated.trustScore).toBe(baseline.trustScore);
    expect(simulated.teamDna).toEqual(baseline.teamDna);
    expect(simulated.matchDna).toEqual(baseline.matchDna);
    expect(simulated.keyFactors).toEqual(baseline.keyFactors);
  });

  it("is deterministic for the same scenario and adjustment payload", () => {
    const adjustment: VctProfileAdjustment = { scalar: {}, dna: { aggression: 10 }, mapStrength: {} };
    const first = simulateVctPrediction(
      request("paper-rex", "g2-esports", adjustment),
      paperRex,
      g2,
      adjustment,
      createEmptyVctProfileAdjustment(),
    );
    const second = simulateVctPrediction(
      request("paper-rex", "g2-esports", adjustment),
      paperRex,
      g2,
      adjustment,
      createEmptyVctProfileAdjustment(),
    );

    expect(second.outcomes).toEqual(first.outcomes);
    expect(second.confidence).toBe(first.confidence);
    expect(second.teamDna).toEqual(first.teamDna);
  });

  it("a large adjustment favoring the underdog and penalizing the favorite moves win probability toward the underdog", () => {
    const boost: VctProfileAdjustment = {
      scalar: {},
      dna: { aggression: 15, tempo: 15, mapControl: 15, utilityEfficiency: 15, adaptability: 15, clutchAbility: 15 },
      mapStrength: {},
    };
    const penalty: VctProfileAdjustment = {
      scalar: {},
      dna: { aggression: -15, tempo: -15, mapControl: -15, utilityEfficiency: -15, adaptability: -15, clutchAbility: -15 },
      mapStrength: {},
    };
    const mapIds = ["icebox", "sunset"];
    const baseline = generateVctPrediction(
      { requestId: "r-underdog-baseline", clientVersion: "web-0.1.0", timestamp: new Date().toISOString(), scenario: { teamAId: "paper-rex", teamBId: "g2-esports", seriesFormat: "BO3", mapIds } },
      paperRex,
      g2,
    );
    const loserId = baseline.outcomes.find((o) => o.teamId !== baseline.predictedWinnerId)!.teamId;
    const loserBaselineProbability = baseline.outcomes.find((o) => o.teamId === loserId)!.winProbability;
    const boostedIsA = loserId === "paper-rex";

    const simulated = simulateVctPrediction(
      request("paper-rex", "g2-esports", boostedIsA ? boost : penalty, boostedIsA ? penalty : boost, mapIds),
      paperRex,
      g2,
      boostedIsA ? boost : penalty,
      boostedIsA ? penalty : boost,
    );
    const loserSimulatedProbability = simulated.outcomes.find((o) => o.teamId === loserId)!.winProbability;

    // Boosting the underdog's DNA and penalizing the favorite's, symmetrically,
    // must move win probability toward the underdog — this is guaranteed by
    // the monotonic weighted-advantage formula regardless of the specific
    // matchup's starting values, so it's a more robust proof of real,
    // engine-computed effect than asserting an exact winner flip.
    expect(loserSimulatedProbability).toBeGreaterThan(loserBaselineProbability);
  });

  it("never mutates VCT_TEAM_PROFILES, even across many varied simulations", () => {
    const before = JSON.parse(JSON.stringify(VCT_TEAM_PROFILES));

    for (let i = 0; i < 20; i++) {
      simulateVctPrediction(
        request("paper-rex", "g2-esports", { scalar: { attackStrength: i - 10 }, dna: { aggression: i - 10 }, mapStrength: { ascent: i - 10 } }),
        paperRex,
        g2,
        { scalar: { attackStrength: i - 10 }, dna: { aggression: i - 10 }, mapStrength: { ascent: i - 10 } },
        createEmptyVctProfileAdjustment(),
      );
    }

    expect(JSON.parse(JSON.stringify(VCT_TEAM_PROFILES))).toEqual(before);
  });

  it("concurrent simulations with different adjustments do not leak into each other", () => {
    const adjustmentA: VctProfileAdjustment = { scalar: {}, dna: { aggression: 15 }, mapStrength: {} };
    const adjustmentB: VctProfileAdjustment = { scalar: {}, dna: { aggression: -15 }, mapStrength: {} };

    const resultsA = simulateVctPrediction(
      request("paper-rex", "g2-esports", adjustmentA, createEmptyVctProfileAdjustment(), ["ascent", "bind"]),
      paperRex,
      g2,
      adjustmentA,
      createEmptyVctProfileAdjustment(),
    );
    const resultsB = simulateVctPrediction(
      request("paper-rex", "g2-esports", adjustmentB, createEmptyVctProfileAdjustment(), ["ascent", "bind"]),
      paperRex,
      g2,
      adjustmentB,
      createEmptyVctProfileAdjustment(),
    );

    const aggressionA = resultsA.teamDna[0].dimensions.find((d) => d.key === "aggression")!.value;
    const aggressionB = resultsB.teamDna[0].dimensions.find((d) => d.key === "aggression")!.value;
    expect(aggressionA).not.toBe(aggressionB);
  });

  it("does not pollute or read from generateVctPrediction's scenario cache", () => {
    const mapIds = ["pearl", "sunset"];
    const boosted: VctProfileAdjustment = { scalar: {}, dna: { aggression: 15 }, mapStrength: {} };

    simulateVctPrediction(
      request("paper-rex", "g2-esports", boosted, createEmptyVctProfileAdjustment(), mapIds),
      paperRex,
      g2,
      boosted,
      createEmptyVctProfileAdjustment(),
    );

    const baseline = generateVctPrediction(
      { requestId: "r-after-sim", clientVersion: "web-0.1.0", timestamp: new Date().toISOString(), scenario: { teamAId: "paper-rex", teamBId: "g2-esports", seriesFormat: "BO3", mapIds } },
      paperRex,
      g2,
    );

    const baselineAggression = baseline.teamDna[0].dimensions.find((d) => d.key === "aggression")!.value;
    const originalProfile = VCT_TEAM_PROFILES.find((p) => p.teamId === "paper-rex")!;
    const originalAggression = originalProfile.dna.dimensions.find((d) => d.key === "aggression")!.value;
    expect(baselineAggression).toBe(originalAggression);
  });

  it("throws when the resolved team identity does not match the scenario", () => {
    expect(() =>
      simulateVctPrediction(
        request("paper-rex", "g2-esports"),
        g2,
        paperRex,
        createEmptyVctProfileAdjustment(),
        createEmptyVctProfileAdjustment(),
      ),
    ).toThrow();
  });

  it("throws for an unknown team", () => {
    const unknown = team("not-a-real-team", "pacific");
    expect(() =>
      simulateVctPrediction(
        request("not-a-real-team", "g2-esports"),
        unknown,
        g2,
        createEmptyVctProfileAdjustment(),
        createEmptyVctProfileAdjustment(),
      ),
    ).toThrow();
  });
});
