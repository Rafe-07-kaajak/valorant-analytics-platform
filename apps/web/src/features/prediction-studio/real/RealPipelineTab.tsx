import { cn } from "@repo/ui";
import type { RealPipelineStage } from "@repo/shared";
import type { RealBreakdownController } from "./useRealBreakdownState";

export interface RealPipelineTabProps {
  stages: readonly RealPipelineStage[];
  breakdown: RealBreakdownController;
}

/**
 * Tab 4 of the Real Prediction Breakdown ("Real Pipeline") — the interactive
 * counterpart to `RealPipelineTimeline.tsx`'s static "How This Prediction Was
 * Made" section. Every stage's `durationMs` is `null` unless genuinely
 * measured (see `realTeamStateBuilder.ts#buildPipelineStages`) — never
 * fabricated, and shown as "not separately measured" rather than 0ms or a
 * blank.
 */
export function RealPipelineTab({ stages, breakdown }: RealPipelineTabProps) {
  return (
    <ol className="flex flex-col gap-sm" aria-label="Real prediction pipeline stages">
      {stages.map((stage, index) => {
        const isSelected = breakdown.selectedStageId === stage.id;
        const isActive = breakdown.activeStageId === stage.id;

        return (
          <li key={stage.id}>
            <button
              type="button"
              aria-current={isSelected}
              onMouseEnter={() => breakdown.hoverStage(stage.id)}
              onMouseLeave={() => breakdown.hoverStage(null)}
              onFocus={() => breakdown.hoverStage(stage.id)}
              onBlur={() => breakdown.hoverStage(null)}
              onClick={() => breakdown.selectStage(stage.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  breakdown.selectStage(stage.id);
                } else if (event.key === "Escape") {
                  breakdown.clear();
                }
              }}
              aria-label={`Stage ${index + 1}: ${stage.label}. ${stage.description}${stage.durationMs !== null ? ` Measured at ${stage.durationMs.toFixed(1)} milliseconds.` : " Timing not separately measured."}`}
              className={cn(
                "flex w-full flex-col gap-2xs rounded-md border bg-surface p-sm text-left",
                "motion-safe:transition-colors motion-safe:duration-(--duration-fast) motion-safe:ease-(--ease-standard)",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                isSelected ? "border-brand-400 bg-brand-400/10" : isActive ? "border-brand-400/70" : "border-surface-border",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2xs">
                <span className="font-medium text-foreground">
                  {index + 1}. {stage.label}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {stage.durationMs !== null ? `${stage.durationMs.toFixed(1)}ms` : "not separately measured"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{stage.description}</p>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
