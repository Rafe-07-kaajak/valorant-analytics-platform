import type { PipelineStage } from "@repo/shared";
import type { PipelineAffect, PipelineStageView } from "./types";

/**
 * Which downstream concern each real pipeline stage feeds, derived directly
 * from that stage's own description text (`services/prediction-engine/src/
 * lib/pipeline.ts`) — a labeling of what the engine's fixed 9-stage
 * pipeline already does, not an invented internal detail. Stage ids not
 * listed here (there are none today, but the pipeline could grow one) fall
 * back to an empty `affects` list rather than a guess.
 */
const STAGE_AFFECTS: Readonly<Record<string, readonly PipelineAffect[]>> = {
  "match-request": [],
  "load-data": ["profile-resolution"],
  validation: ["validation"],
  "feature-extraction": ["profile-resolution"],
  "team-dna": ["profile-resolution", "match-dna"],
  "match-dna": ["match-dna"],
  prediction: ["contribution-weighting"],
  "confidence-estimation": ["confidence"],
  "explanation-generation": ["explanation-generation"],
};

/**
 * Builds the Pipeline tab's view-model straight from `result.pipeline` —
 * order is the array's own order (the engine always returns the fixed 9
 * stages in a fixed sequence), duration is untouched. The real `PipelineStage`
 * contract has no status field, so every stage here is `"complete"` — that's
 * an accurate reflection of the current data, not a fabricated state.
 */
export function buildPipelineStageViews(pipeline: readonly PipelineStage[]): PipelineStageView[] {
  return pipeline.map((stage, index) => ({
    id: stage.id,
    label: stage.label,
    description: stage.description,
    durationMs: stage.durationMs,
    order: index + 1,
    status: "complete",
    affects: [...(STAGE_AFFECTS[stage.id] ?? [])],
  }));
}
