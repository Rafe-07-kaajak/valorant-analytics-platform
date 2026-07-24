import { describe, expect, it } from "vitest";
import { expectedWinProbabilityFromElo } from "./eloSensitivity";

describe("expectedWinProbabilityFromElo", () => {
  it("returns exactly 0.5 for equal ratings", () => {
    expect(expectedWinProbabilityFromElo(1500, 1500)).toBeCloseTo(0.5, 10);
  });

  it("matches the known standard Elo formula for a 400-point gap (10x odds)", () => {
    // A 400-point rating gap is the textbook case where the formula gives
    // exactly a 10:1 expected odds ratio, i.e. probability = 10/11.
    expect(expectedWinProbabilityFromElo(1900, 1500)).toBeCloseTo(10 / 11, 6);
  });

  it("is symmetric: swapping the two ratings gives complementary probabilities", () => {
    const a = expectedWinProbabilityFromElo(1600, 1450);
    const b = expectedWinProbabilityFromElo(1450, 1600);
    expect(a + b).toBeCloseTo(1, 10);
  });

  it("always stays within (0, 1)", () => {
    expect(expectedWinProbabilityFromElo(3000, 100)).toBeGreaterThan(0);
    expect(expectedWinProbabilityFromElo(3000, 100)).toBeLessThan(1);
    expect(expectedWinProbabilityFromElo(100, 3000)).toBeGreaterThan(0);
    expect(expectedWinProbabilityFromElo(100, 3000)).toBeLessThan(1);
  });
});
