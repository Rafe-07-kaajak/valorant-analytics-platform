import type { PipelineStage } from "@repo/shared";
import { seededRatio } from "./seededRatio";

const STAGE_DEFINITIONS: { id: string; label: string; description: string; baseMs: number }[] = [
  { id: "match-request", label: "Match Request", description: "Captured the selected teams and scenario.", baseMs: 4 },
  { id: "load-data", label: "Load Data", description: "Retrieved team statistics and recent form.", baseMs: 18 },
  { id: "validation", label: "Validation", description: "Confirmed sufficient historical data and supported maps.", baseMs: 12 },
  { id: "feature-extraction", label: "Feature Extraction", description: "Converted raw statistics into behavioral features.", baseMs: 26 },
  { id: "team-dna", label: "Team DNA", description: "Generated a behavioral profile for each team.", baseMs: 22 },
  { id: "match-dna", label: "Match DNA", description: "Compared both profiles to find complementary and conflicting traits.", baseMs: 20 },
  { id: "prediction", label: "Prediction", description: "Estimated win probability from the compared profiles.", baseMs: 15 },
  { id: "confidence-estimation", label: "Confidence Estimation", description: "Measured certainty based on data quality and feature agreement.", baseMs: 10 },
  { id: "explanation-generation", label: "Explanation Generation", description: "Converted the reasoning into human-readable insights.", baseMs: 14 },
];

export function generatePipeline(seed: string): PipelineStage[] {
  return STAGE_DEFINITIONS.map((stage) => ({
    id: stage.id,
    label: stage.label,
    description: stage.description,
    durationMs: Math.round(stage.baseMs + seededRatio(`${seed}:${stage.id}`) * stage.baseMs * 0.6),
  }));
}
