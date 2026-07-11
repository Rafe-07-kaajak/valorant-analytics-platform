import { describe, expect, it } from "vitest";
import { DNA_DIMENSIONS, generateTeamDna } from "./teamDna";

describe("generateTeamDna", () => {
  it("is deterministic for the same team", () => {
    expect(generateTeamDna("sen")).toEqual(generateTeamDna("sen"));
  });

  it("produces a different profile for a different team", () => {
    expect(generateTeamDna("sen")).not.toEqual(generateTeamDna("loud"));
  });

  it("includes every documented dimension exactly once", () => {
    const dna = generateTeamDna("sen");
    expect(dna.dimensions).toHaveLength(DNA_DIMENSIONS.length);
    const keys = dna.dimensions.map((d) => d.key);
    expect(new Set(keys).size).toBe(DNA_DIMENSIONS.length);
  });

  it("keeps every dimension value within the designed 30-95 range", () => {
    const dna = generateTeamDna("prx");
    for (const dimension of dna.dimensions) {
      expect(dimension.value).toBeGreaterThanOrEqual(30);
      expect(dimension.value).toBeLessThanOrEqual(95);
    }
  });
});
