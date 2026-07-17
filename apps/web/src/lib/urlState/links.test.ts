import { describe, expect, it } from "vitest";
import { buildFeatureHref, generateFeatureLinks } from "./links";
import { EMPTY_CANONICAL_URL_STATE, type CanonicalUrlState } from "./types";

const BOTH_TEAMS: CanonicalUrlState = {
  regionA: "pacific",
  teamA: "paper-rex",
  regionB: "americas",
  teamB: "g2-esports",
  maps: ["ascent", "haven"],
  format: "BO3",
};

describe("buildFeatureHref", () => {
  it("builds a Prediction Studio href with teams, maps, and format", () => {
    expect(buildFeatureHref("prediction-studio", BOTH_TEAMS)).toBe(
      "/prediction-studio?regionA=pacific&teamA=paper-rex&regionB=americas&teamB=g2-esports&maps=ascent%2Chaven&format=BO3",
    );
  });

  it("builds a Team Comparison Lab href that ignores maps and format", () => {
    expect(buildFeatureHref("team-comparison", BOTH_TEAMS)).toBe(
      "/team-comparison?regionA=pacific&teamA=paper-rex&regionB=americas&teamB=g2-esports",
    );
  });

  it("builds a Map Matchup Explorer href that carries maps but ignores format", () => {
    expect(buildFeatureHref("map-matchup", BOTH_TEAMS)).toBe(
      "/map-matchup?regionA=pacific&teamA=paper-rex&regionB=americas&teamB=g2-esports&maps=ascent%2Chaven",
    );
  });

  it("returns a bare route with no query string when state is empty", () => {
    expect(buildFeatureHref("team-comparison", EMPTY_CANONICAL_URL_STATE)).toBe("/team-comparison");
  });
});

describe("generateFeatureLinks", () => {
  it("returns no links until both teams are selected", () => {
    expect(generateFeatureLinks("prediction-studio", EMPTY_CANONICAL_URL_STATE)).toEqual([]);
    expect(generateFeatureLinks("prediction-studio", { ...EMPTY_CANONICAL_URL_STATE, teamA: "paper-rex" })).toEqual([]);
  });

  it("excludes the current feature", () => {
    const links = generateFeatureLinks("prediction-studio", BOTH_TEAMS);
    expect(links.map((link) => link.feature)).not.toContain("prediction-studio");
    expect(links).toHaveLength(2);
  });

  it("uses Prediction Studio's specific labels for its two destinations", () => {
    const links = generateFeatureLinks("prediction-studio", BOTH_TEAMS);
    expect(links.find((link) => link.feature === "team-comparison")?.label).toBe("Compare Teams");
    expect(links.find((link) => link.feature === "map-matchup")?.label).toBe("Explore Maps");
  });

  it("uses Team Comparison Lab's specific labels for its two destinations", () => {
    const links = generateFeatureLinks("team-comparison", BOTH_TEAMS);
    expect(links.find((link) => link.feature === "prediction-studio")?.label).toBe("Open in Prediction Studio");
    expect(links.find((link) => link.feature === "map-matchup")?.label).toBe("Explore Map Matchup");
  });

  it("uses Map Matchup Explorer's specific labels for its two destinations", () => {
    const links = generateFeatureLinks("map-matchup", BOTH_TEAMS);
    expect(links.find((link) => link.feature === "prediction-studio")?.label).toBe("Open in Prediction Studio");
    expect(links.find((link) => link.feature === "team-comparison")?.label).toBe("Compare Teams");
  });

  it("includes both team names in every accessible name", () => {
    const links = generateFeatureLinks("prediction-studio", BOTH_TEAMS);
    for (const link of links) {
      expect(link.ariaLabel).toMatch(/Paper Rex/);
      expect(link.ariaLabel).toMatch(/G2 Esports/);
    }
  });

  it("carries the preserved context through each generated href", () => {
    const links = generateFeatureLinks("team-comparison", BOTH_TEAMS);
    const mapMatchupLink = links.find((link) => link.feature === "map-matchup")!;
    expect(mapMatchupLink.href).toContain("teamA=paper-rex");
    expect(mapMatchupLink.href).toContain("teamB=g2-esports");
  });
});
