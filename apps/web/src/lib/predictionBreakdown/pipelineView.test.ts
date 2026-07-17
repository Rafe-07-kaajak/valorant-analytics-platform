import { describe, expect, it } from "vitest";
import type { PipelineStage } from "@repo/shared";
import { buildPipelineStageViews } from "./pipelineView";

const REAL_PIPELINE: PipelineStage[] = [
  { id: "match-request", label: "Match Request", description: "Captured the selected teams and scenario.", durationMs: 4 },
  { id: "load-data", label: "Load Data", description: "Retrieved team statistics and recent form.", durationMs: 18 },
  { id: "validation", label: "Validation", description: "Confirmed sufficient historical data and supported maps.", durationMs: 12 },
  { id: "feature-extraction", label: "Feature Extraction", description: "Converted raw statistics into behavioral features.", durationMs: 26 },
  { id: "team-dna", label: "Team DNA", description: "Generated a behavioral profile for each team.", durationMs: 22 },
  { id: "match-dna", label: "Match DNA", description: "Compared both profiles to find complementary and conflicting traits.", durationMs: 20 },
  { id: "prediction", label: "Prediction", description: "Estimated win probability from the compared profiles.", durationMs: 15 },
  { id: "confidence-estimation", label: "Confidence Estimation", description: "Measured certainty based on data quality and feature agreement.", durationMs: 10 },
  { id: "explanation-generation", label: "Explanation Generation", description: "Converted the reasoning into human-readable insights.", durationMs: 14 },
];

describe("buildPipelineStageViews", () => {
  it("produces one view per stage, in the same order, 1-based", () => {
    const views = buildPipelineStageViews(REAL_PIPELINE);
    expect(views).toHaveLength(9);
    expect(views.map((view) => view.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(views.map((view) => view.id)).toEqual(REAL_PIPELINE.map((stage) => stage.id));
  });

  it("preserves label/description/durationMs untouched", () => {
    const [first] = buildPipelineStageViews(REAL_PIPELINE);
    expect(first!.label).toBe("Match Request");
    expect(first!.description).toBe("Captured the selected teams and scenario.");
    expect(first!.durationMs).toBe(4);
  });

  it("marks every real stage as complete — no fabricated error/skipped state", () => {
    const views = buildPipelineStageViews(REAL_PIPELINE);
    expect(views.every((view) => view.status === "complete")).toBe(true);
  });

  it("assigns a documented, non-empty affects list to every known stage", () => {
    const views = buildPipelineStageViews(REAL_PIPELINE);
    const teamDnaView = views.find((view) => view.id === "team-dna")!;
    expect(teamDnaView.affects).toEqual(["profile-resolution", "match-dna"]);
    const validationView = views.find((view) => view.id === "validation")!;
    expect(validationView.affects).toEqual(["validation"]);
  });

  it("falls back to an empty affects list for an unknown stage id, rather than crashing", () => {
    const views = buildPipelineStageViews([
      { id: "future-stage", label: "Future Stage", description: "Not yet categorized.", durationMs: 5 },
    ]);
    expect(views[0]!.affects).toEqual([]);
  });

  it("handles an empty pipeline without crashing", () => {
    expect(buildPipelineStageViews([])).toEqual([]);
  });

  it("is deterministic for the same input", () => {
    expect(buildPipelineStageViews(REAL_PIPELINE)).toEqual(buildPipelineStageViews(REAL_PIPELINE));
  });
});
