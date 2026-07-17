import { describe, expect, it } from "vitest";
import { generatePoolSummary } from "./poolSummary";
import type { PoolAggregate } from "./types";

function aggregate(overrides: Partial<PoolAggregate> = {}): PoolAggregate {
  return {
    mapCount: 3,
    averageA: 60,
    averageB: 60,
    advantage: "even",
    tier: "none",
    magnitude: 0,
    favoringA: 1,
    favoringB: 1,
    close: 1,
    strongestA: null,
    strongestB: null,
    closest: null,
    largestGap: null,
    ...overrides,
  };
}

const TEAM_A = "Paper Rex";
const TEAM_B = "G2 Esports";

describe("generatePoolSummary", () => {
  it("describes a close aggregate neutrally without a win claim", () => {
    const summary = generatePoolSummary(TEAM_A, TEAM_B, aggregate({ advantage: "even" }));
    expect(summary).toContain(TEAM_A);
    expect(summary).toContain(TEAM_B);
    expect(summary.toLowerCase()).toContain("close overall");
  });

  it("names the favored team and includes the per-side breakdown", () => {
    const summary = generatePoolSummary(
      TEAM_A,
      TEAM_B,
      aggregate({ advantage: "B", tier: "slight", favoringA: 2, favoringB: 2, close: 1, mapCount: 5 }),
    );
    expect(summary).toContain("slightly favors G2 Esports");
    expect(summary).toContain("2 maps favoring Paper Rex");
    expect(summary).toContain("2 favoring G2 Esports");
    expect(summary).toContain("1 close matchup");
  });

  it("handles a single-map pool with correct singular wording", () => {
    const summary = generatePoolSummary(
      TEAM_A,
      TEAM_B,
      aggregate({ mapCount: 1, advantage: "A", tier: "strong", favoringA: 1, favoringB: 0, close: 0 }),
    );
    expect(summary).toContain("The selected map");
    expect(summary).toContain("1 map favoring Paper Rex");
  });

  it("never contains win-probability or tournament veto language", () => {
    const summary = generatePoolSummary(TEAM_A, TEAM_B, aggregate({ advantage: "A", tier: "moderate" }));
    for (const forbidden of ["win probability", "will win", "veto", "ban", "guaranteed"]) {
      expect(summary.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("is deterministic for the same input", () => {
    const value = aggregate({ advantage: "A", tier: "strong" });
    expect(generatePoolSummary(TEAM_A, TEAM_B, value)).toBe(generatePoolSummary(TEAM_A, TEAM_B, value));
  });
});
