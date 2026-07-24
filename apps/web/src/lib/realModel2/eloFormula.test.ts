import { describe, expect, it } from "vitest";
import { expectedWinProbabilityFromElo } from "./eloFormula";

describe("expectedWinProbabilityFromElo", () => {
  it("returns exactly 0.5 for equal ratings", () => {
    expect(expectedWinProbabilityFromElo(1500, 1500)).toBeCloseTo(0.5, 10);
  });

  it("matches the known standard Elo formula for a 400-point gap (10x odds)", () => {
    expect(expectedWinProbabilityFromElo(1900, 1500)).toBeCloseTo(10 / 11, 6);
  });

  it("is symmetric: swapping the two ratings gives complementary probabilities", () => {
    const a = expectedWinProbabilityFromElo(1600, 1450);
    const b = expectedWinProbabilityFromElo(1450, 1600);
    expect(a + b).toBeCloseTo(1, 10);
  });
});
