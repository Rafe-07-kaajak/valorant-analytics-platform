import { describe, expect, it } from "vitest";
import { seededRatio } from "./seededRatio";

describe("seededRatio", () => {
  it("is deterministic for the same seed", () => {
    expect(seededRatio("sen:loud:BO3")).toBe(seededRatio("sen:loud:BO3"));
  });

  it("produces different values for different seeds", () => {
    expect(seededRatio("sen:loud")).not.toBe(seededRatio("loud:sen"));
  });

  it("always returns a value in [0, 1)", () => {
    const seeds = ["a", "team:x:y", "", "confidence:sen:loud", "z".repeat(50)];
    for (const seed of seeds) {
      const value = seededRatio(seed);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
