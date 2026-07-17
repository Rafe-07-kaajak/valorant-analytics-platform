import { describe, expect, it } from "vitest";
import { createEmptyMapDraft, createEmptyTeamDraft, setAttributeDelta, setMapDelta } from "./draftState";
import { summarizeAdjustments } from "./adjustmentSummary";

const mapLabel = (mapId: string) => (mapId === "ascent" ? "Ascent" : mapId);

describe("summarizeAdjustments", () => {
  it("returns the safe empty-state sentence when nothing changed", () => {
    const empty = createEmptyTeamDraft();
    const emptyMap = createEmptyMapDraft(["ascent"]);
    expect(summarizeAdjustments("Paper Rex", "G2 Esports", empty, empty, emptyMap, emptyMap, mapLabel)).toBe(
      "No hypothetical adjustments applied.",
    );
  });

  it("omits zero-value attributes and includes only what changed", () => {
    let teamA = createEmptyTeamDraft();
    teamA = setAttributeDelta(teamA, "attackStrength", 6);
    teamA = setAttributeDelta(teamA, "tempo", 4);
    const empty = createEmptyTeamDraft();
    const emptyMap = createEmptyMapDraft([]);

    const summary = summarizeAdjustments("Paper Rex", "G2 Esports", teamA, empty, emptyMap, emptyMap, mapLabel);
    expect(summary).toContain("Paper Rex: Attack Strength +6, Tempo +4.");
    expect(summary).not.toContain("G2 Esports");
  });

  it("includes negative deltas with an explicit minus sign", () => {
    let teamB = createEmptyTeamDraft();
    teamB = setAttributeDelta(teamB, "defenseStrength", -3);
    const empty = createEmptyTeamDraft();
    const emptyMap = createEmptyMapDraft([]);

    const summary = summarizeAdjustments("Paper Rex", "G2 Esports", empty, teamB, emptyMap, emptyMap, mapLabel);
    expect(summary).toContain("G2 Esports: Defense Strength -3.");
  });

  it("includes map adjustments with the team and map name", () => {
    const empty = createEmptyTeamDraft();
    const mapDraft = setMapDelta(createEmptyMapDraft(["ascent"]), "ascent", 5);
    const emptyMap = createEmptyMapDraft(["ascent"]);

    const summary = summarizeAdjustments("Paper Rex", "G2 Esports", empty, empty, mapDraft, emptyMap, mapLabel);
    expect(summary).toContain("Maps: Ascent Paper Rex +5.");
  });

  it("is deterministic for the same input", () => {
    let teamA = createEmptyTeamDraft();
    teamA = setAttributeDelta(teamA, "tempo", 2);
    const empty = createEmptyTeamDraft();
    const emptyMap = createEmptyMapDraft([]);

    const first = summarizeAdjustments("Paper Rex", "G2 Esports", teamA, empty, emptyMap, emptyMap, mapLabel);
    const second = summarizeAdjustments("Paper Rex", "G2 Esports", teamA, empty, emptyMap, emptyMap, mapLabel);
    expect(first).toBe(second);
  });

  it("never renders raw JSON", () => {
    let teamA = createEmptyTeamDraft();
    teamA = setAttributeDelta(teamA, "tempo", 2);
    const empty = createEmptyTeamDraft();
    const emptyMap = createEmptyMapDraft([]);
    const summary = summarizeAdjustments("Paper Rex", "G2 Esports", teamA, empty, emptyMap, emptyMap, mapLabel);
    expect(summary).not.toMatch(/[{}[\]]/);
  });
});
