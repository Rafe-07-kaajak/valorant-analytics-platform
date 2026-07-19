import { describe, expect, it } from "vitest";
import { applyEloUpdate, createEloState, expectedWinProbability, getEloRating } from "./elo";
import { DEFAULT_ELO_CONFIG } from "./versions";

describe("elo", () => {
  it("returns the configured initial rating for an unseen team", () => {
    const state = createEloState();
    expect(getEloRating(state, "team-x", DEFAULT_ELO_CONFIG)).toBe(1500);
  });

  it("expected win probability is 0.5 for equal ratings", () => {
    expect(expectedWinProbability(1500, 1500)).toBeCloseTo(0.5);
  });

  it("favors the higher-rated team", () => {
    expect(expectedWinProbability(1600, 1400)).toBeGreaterThan(0.5);
    expect(expectedWinProbability(1400, 1600)).toBeLessThan(0.5);
  });

  it("increases the winner's rating and decreases the loser's by the same magnitude", () => {
    const state = createEloState();
    applyEloUpdate(state, "team-a", "team-b", true, DEFAULT_ELO_CONFIG);
    const ratingA = getEloRating(state, "team-a", DEFAULT_ELO_CONFIG);
    const ratingB = getEloRating(state, "team-b", DEFAULT_ELO_CONFIG);
    expect(ratingA).toBeGreaterThan(1500);
    expect(ratingB).toBeLessThan(1500);
    expect(ratingA - 1500).toBeCloseTo(1500 - ratingB);
  });

  it("is deterministic across repeated replays of the same sequence", () => {
    const runOnce = () => {
      const state = createEloState();
      applyEloUpdate(state, "team-a", "team-b", true, DEFAULT_ELO_CONFIG);
      applyEloUpdate(state, "team-b", "team-a", true, DEFAULT_ELO_CONFIG);
      return getEloRating(state, "team-a", DEFAULT_ELO_CONFIG);
    };
    expect(runOnce()).toBe(runOnce());
  });

  it("respects a configurable K-factor", () => {
    const lowK = { ...DEFAULT_ELO_CONFIG, kFactor: 4 };
    const highK = { ...DEFAULT_ELO_CONFIG, kFactor: 40 };
    const lowState = createEloState();
    const highState = createEloState();
    applyEloUpdate(lowState, "team-a", "team-b", true, lowK);
    applyEloUpdate(highState, "team-a", "team-b", true, highK);
    const lowDelta = getEloRating(lowState, "team-a", lowK) - 1500;
    const highDelta = getEloRating(highState, "team-a", highK) - 1500;
    expect(highDelta).toBeGreaterThan(lowDelta);
  });

  it("handles simultaneous independent matches without cross-contamination", () => {
    const state = createEloState();
    applyEloUpdate(state, "team-a", "team-b", true, DEFAULT_ELO_CONFIG);
    applyEloUpdate(state, "team-c", "team-d", true, DEFAULT_ELO_CONFIG);
    expect(getEloRating(state, "team-c", DEFAULT_ELO_CONFIG)).toBeGreaterThan(1500);
    expect(getEloRating(state, "team-b", DEFAULT_ELO_CONFIG)).toBeLessThan(1500);
  });
});
