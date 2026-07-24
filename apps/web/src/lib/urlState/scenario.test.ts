import { describe, expect, it } from "vitest";
import type { Scenario } from "@repo/shared";
import { scenarioToCanonicalState } from "./scenario";

describe("scenarioToCanonicalState", () => {
  it("projects a scenario's teams, maps, and format, deriving each region", () => {
    const scenario: Scenario = {
      teamAId: "paper-rex",
      teamBId: "g2-esports",
      seriesFormat: "BO3",
      mapIds: ["ascent", "haven", "bind"],
    };

    expect(scenarioToCanonicalState(scenario)).toEqual({
      regionA: "pacific",
      teamA: "paper-rex",
      regionB: "americas",
      teamB: "g2-esports",
      maps: ["ascent", "haven", "bind"],
      format: "BO3",
      mode: null,
    });
  });

  it("does not mutate the source scenario's mapIds array", () => {
    const mapIds = ["ascent"];
    const scenario: Scenario = { teamAId: "paper-rex", teamBId: "g2-esports", seriesFormat: "BO3", mapIds };
    const state = scenarioToCanonicalState(scenario);
    state.maps.push("haven");
    expect(mapIds).toEqual(["ascent"]);
  });
});
