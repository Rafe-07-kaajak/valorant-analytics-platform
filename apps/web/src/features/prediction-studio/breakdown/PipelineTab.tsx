import type { KeyboardEvent } from "react";
import { cn } from "@repo/ui";
import type { BreakdownController } from "./useBreakdownState";
import type { PipelineStageView } from "../../../lib/predictionBreakdown";

export interface PipelineTabProps {
  stages: PipelineStageView[];
  breakdown: BreakdownController;
}

const AFFECT_LABELS: Record<string, string> = {
  validation: "Validation",
  "profile-resolution": "Team profile resolution",
  "match-dna": "Match DNA",
  "contribution-weighting": "Contribution weighting",
  confidence: "Confidence score",
  "explanation-generation": "Explanation text",
};

/**
 * Stages are rendered in the engine's own fixed order (`buildPipelineStageViews`
 * preserves `result.pipeline`'s array order). Selecting a stage reveals its
 * real `affects` list and duration — genuine data already on the stage, not a
 * fabricated detail — so the row is legitimately interactive rather than
 * decoratively clickable.
 */
export function PipelineTab({ stages, breakdown }: PipelineTabProps) {
  if (stages.length === 0) {
    return <p className="text-sm text-muted-foreground">No pipeline stages were recorded for this prediction.</p>;
  }

  return (
    <ol className="flex flex-col gap-sm" aria-label="Prediction pipeline stages, in order">
      {stages.map((stage) => (
        <PipelineStageRow key={stage.id} stage={stage} breakdown={breakdown} />
      ))}
    </ol>
  );
}

function PipelineStageRow({ stage, breakdown }: { stage: PipelineStageView; breakdown: BreakdownController }) {
  const isSelected = breakdown.selectedStageId === stage.id;
  const isActive = breakdown.activeStageId === stage.id;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      breakdown.selectStage(stage.id);
    } else if (event.key === "Escape") {
      breakdown.clear();
    }
  };

  return (
    <li>
      <button
        type="button"
        aria-current={isSelected}
        aria-expanded={isActive}
        onMouseEnter={() => breakdown.hoverStage(stage.id)}
        onMouseLeave={() => breakdown.hoverStage(null)}
        onFocus={() => breakdown.hoverStage(stage.id)}
        onBlur={() => breakdown.hoverStage(null)}
        onClick={() => breakdown.selectStage(stage.id)}
        onKeyDown={handleKeyDown}
        aria-label={`Stage ${stage.order}: ${stage.label}, complete, ${stage.durationMs} milliseconds`}
        className={cn(
          "flex w-full flex-col gap-2xs rounded-md border bg-surface p-sm text-left",
          "motion-safe:transition-[border-color,box-shadow] motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard)",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
          isSelected
            ? "border-brand-400 shadow-[0_0_0_1px_var(--color-brand-400),0_0_16px_-6px_var(--color-brand-400)]"
            : isActive
              ? "border-brand-400/70"
              : "border-surface-border",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2xs">
          <span className="font-medium text-foreground">
            {stage.order}. {stage.label}
          </span>
          <span className="text-sm text-muted-foreground">{stage.durationMs}ms · complete</span>
        </div>
        <p className="text-sm text-muted-foreground">{stage.description}</p>
        {isActive && stage.affects.length > 0 ? (
          <ul className="flex flex-wrap gap-2xs pt-2xs" aria-label={`What ${stage.label} affects`}>
            {stage.affects.map((affect) => (
              <li
                key={affect}
                className="rounded-full border border-surface-border bg-surface-muted px-xs py-3xs text-xs text-muted-foreground"
              >
                {AFFECT_LABELS[affect] ?? affect}
              </li>
            ))}
          </ul>
        ) : null}
      </button>
    </li>
  );
}
