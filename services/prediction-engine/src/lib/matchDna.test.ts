import { describe, expect, it } from "vitest";
import type { TeamDna } from "@repo/shared";
import { generateMatchDna } from "./matchDna";

function dna(teamId: string, values: Record<string, number>): TeamDna {
  return {
    teamId,
    dimensions: Object.entries(values).map(([key, value]) => ({
      key: key as TeamDna["dimensions"][number]["key"],
      label: key,
      value,
    })),
  };
}

describe("generateMatchDna", () => {
  it("gives identical teams a perfect similarity score and no conflicts", () => {
    const a = dna("a", { aggression: 70, tempo: 60 });
    const b = dna("b", { aggression: 70, tempo: 60 });

    const result = generateMatchDna(a, b);

    expect(result.similarityScore).toBe(100);
    expect(result.conflictingTraits).toHaveLength(0);
  });

  it("flags a wide gap as a conflicting trait", () => {
    const a = dna("a", { aggression: 90, tempo: 50 });
    const b = dna("b", { aggression: 20, tempo: 50 });

    const result = generateMatchDna(a, b);

    expect(result.conflictingTraits).toContain("aggression");
    expect(result.conflictingTraits).not.toContain("tempo");
  });

  it("picks the dimension with the largest gap as the decisive trait", () => {
    const a = dna("a", { aggression: 90, tempo: 55, mapControl: 50 });
    const b = dna("b", { aggression: 40, tempo: 50, mapControl: 48 });

    const result = generateMatchDna(a, b);

    expect(result.decisiveTrait).toBe("aggression");
  });

  it("flags a small gap between two high scores as a complementary trait", () => {
    const a = dna("a", { clutchAbility: 80 });
    const b = dna("b", { clutchAbility: 75 });

    const result = generateMatchDna(a, b);

    expect(result.complementaryTraits).toContain("clutchAbility");
  });
});
