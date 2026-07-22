import { describe, expect, it } from "vitest";
import { buildCuratedMatch } from "../testUtils/curatedMatchFixture";
import type { NormalizedEvent } from "../normalize/normalizedSchemas";
import { runFeatureStateEngine } from "./stateEngine";
import { buildEventsById } from "./curatedSource";
import { DEFAULT_ELO_CONFIG } from "./versions";
import { validateFeatureRows, validateSplitAssignments } from "./featureValidation";
import { assignSplits, computeSplitBoundaries } from "./splits";
import type { FeatureRow } from "./types";

function buildEvent(): NormalizedEvent {
  return {
    internalId: "vlr:event:1",
    name: "Test Event",
    status: "completed",
    startDate: { iso: "2025-01-01T00:00:00.000Z", raw: "raw", confidence: "high" },
    endDate: { iso: "2025-01-10T00:00:00.000Z", raw: "raw", confidence: "high" },
    tournamentLevel: "league",
    region: "americas",
    eventFamily: "vct-americas",
    classification: { classification: "vct-americas", confidence: "authoritative", reason: "r", evidence: [] },
    metadata: { provider: "vlr", providerExternalId: "1", sourceUrl: "https://www.vlr.gg/event/1", fetchedAt: "t", parsedAt: "t", schemaVersion: "1.0.0", contentHash: "h" },
  };
}

describe("validateFeatureRows", () => {
  it("passes for a well-formed single-match dataset", () => {
    const match = buildCuratedMatch();
    const events = buildEventsById([buildEvent()]);
    const { rows } = runFeatureStateEngine([match], events, { eloConfig: DEFAULT_ELO_CONFIG, sourceDatasetVersion: "v1" });
    const result = validateFeatureRows(rows, [match]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("flags a duplicate feature row", () => {
    const match = buildCuratedMatch();
    const events = buildEventsById([buildEvent()]);
    const { rows } = runFeatureStateEngine([match], events, { eloConfig: DEFAULT_ELO_CONFIG, sourceDatasetVersion: "v1" });
    const result = validateFeatureRows([...rows, rows[0]!], [match]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Duplicate"))).toBe(true);
  });

  it("flags non-chronological output", () => {
    const match = buildCuratedMatch();
    const events = buildEventsById([buildEvent()]);
    const { rows } = runFeatureStateEngine([match], events, { eloConfig: DEFAULT_ELO_CONFIG, sourceDatasetVersion: "v1" });
    const reordered: FeatureRow[] = [{ ...rows[0]!, scheduledAt: "2030-01-01T00:00:00.000Z" }, rows[0]!];
    const result = validateFeatureRows(reordered, [match]);
    expect(result.errors.some((e) => e.includes("Non-chronological"))).toBe(true);
  });

  it("flags a row referencing a match outside the curated set", () => {
    const match = buildCuratedMatch();
    const events = buildEventsById([buildEvent()]);
    const { rows } = runFeatureStateEngine([match], events, { eloConfig: DEFAULT_ELO_CONFIG, sourceDatasetVersion: "v1" });
    const result = validateFeatureRows(rows, []); // empty curated set
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("curated set"))).toBe(true);
  });

  it("flags a NaN/Infinity value", () => {
    const match = buildCuratedMatch();
    const events = buildEventsById([buildEvent()]);
    const { rows } = runFeatureStateEngine([match], events, { eloConfig: DEFAULT_ELO_CONFIG, sourceDatasetVersion: "v1" });
    const corrupted: FeatureRow = { ...rows[0]!, teamAEloRating: Number.NaN };
    const result = validateFeatureRows([corrupted], [match]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("non-finite"))).toBe(true);
  });

  it("flags an out-of-bounds rate value", () => {
    const match = buildCuratedMatch();
    const events = buildEventsById([buildEvent()]);
    const { rows } = runFeatureStateEngine([match], events, { eloConfig: DEFAULT_ELO_CONFIG, sourceDatasetVersion: "v1" });
    const corrupted: FeatureRow = { ...rows[0]!, teamACumulativeWinRate: 1.5 };
    const result = validateFeatureRows([corrupted], [match]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("out-of-bounds"))).toBe(true);
  });

  it("flags a negative count value", () => {
    const match = buildCuratedMatch();
    const events = buildEventsById([buildEvent()]);
    const { rows } = runFeatureStateEngine([match], events, { eloConfig: DEFAULT_ELO_CONFIG, sourceDatasetVersion: "v1" });
    const corrupted: FeatureRow = { ...rows[0]!, teamAPriorMatchCount: -1 };
    const result = validateFeatureRows([corrupted], [match]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("negative value"))).toBe(true);
  });

  it("allows legitimately signed differential/trend/Elo fields to be negative", () => {
    const match = buildCuratedMatch();
    const events = buildEventsById([buildEvent()]);
    const { rows } = runFeatureStateEngine([match], events, { eloConfig: DEFAULT_ELO_CONFIG, sourceDatasetVersion: "v1" });
    const modified: FeatureRow = { ...rows[0]!, eloRatingDiff: -50, restDifferenceDays: -3, teamAFormTrend: -0.2 };
    const result = validateFeatureRows([modified], [match]);
    expect(result.valid).toBe(true);
  });

  it("flags a label mismatch against the source match", () => {
    const match = buildCuratedMatch();
    const events = buildEventsById([buildEvent()]);
    const { rows } = runFeatureStateEngine([match], events, { eloConfig: DEFAULT_ELO_CONFIG, sourceDatasetVersion: "v1" });
    const corrupted: FeatureRow = { ...rows[0]!, labelTeamAWin: rows[0]!.labelTeamAWin === 1 ? 0 : 1 };
    const result = validateFeatureRows([corrupted], [match]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Label mismatch"))).toBe(true);
  });

  it("catches current-match-result leakage via the independent recount cross-check", () => {
    const match = buildCuratedMatch();
    const events = buildEventsById([buildEvent()]);
    const { rows } = runFeatureStateEngine([match], events, { eloConfig: DEFAULT_ELO_CONFIG, sourceDatasetVersion: "v1" });
    // Simulate a leakage bug: as if this match's own result had already been folded into its own prior-count.
    const leaked: FeatureRow = { ...rows[0]!, teamAPriorMatchCount: 1 };
    const result = validateFeatureRows([leaked], [match]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Leakage check failed"))).toBe(true);
  });
});

describe("validateSplitAssignments", () => {
  it("passes for a correctly assigned chronological split", () => {
    const match = buildCuratedMatch();
    const events = buildEventsById([buildEvent()]);
    const { rows } = runFeatureStateEngine([match], events, { eloConfig: DEFAULT_ELO_CONFIG, sourceDatasetVersion: "v1" });
    const boundaries = computeSplitBoundaries(rows);
    const assignments = assignSplits(rows, boundaries);
    const result = validateSplitAssignments(rows, assignments);
    expect(result.valid).toBe(true);
  });

  it("flags a row missing a split assignment", () => {
    const match = buildCuratedMatch();
    const events = buildEventsById([buildEvent()]);
    const { rows } = runFeatureStateEngine([match], events, { eloConfig: DEFAULT_ELO_CONFIG, sourceDatasetVersion: "v1" });
    const result = validateSplitAssignments(rows, []);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("no split assignment"))).toBe(true);
  });

  it("flags a duplicate split assignment", () => {
    const match = buildCuratedMatch();
    const events = buildEventsById([buildEvent()]);
    const { rows } = runFeatureStateEngine([match], events, { eloConfig: DEFAULT_ELO_CONFIG, sourceDatasetVersion: "v1" });
    const boundaries = computeSplitBoundaries(rows);
    const assignments = assignSplits(rows, boundaries);
    const result = validateSplitAssignments(rows, [...assignments, assignments[0]!]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("multiple split"))).toBe(true);
  });
});
