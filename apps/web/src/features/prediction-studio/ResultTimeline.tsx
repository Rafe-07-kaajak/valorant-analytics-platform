import type { PipelineStage } from "@repo/shared";
import { Card } from "@repo/ui";
import { MediaBackground } from "../../components/media/MediaBackground";
import { MEDIA_ASSETS } from "../../constants/media";

export interface ResultTimelineProps {
  stages: PipelineStage[];
}

export function ResultTimeline({ stages }: ResultTimelineProps) {
  const measuredStages = stages.filter((stage): stage is typeof stage & { durationMs: number } => stage.durationMs !== null);
  const totalMs = measuredStages.reduce((sum, stage) => sum + stage.durationMs, 0);
  const totalLabel = measuredStages.length === stages.length ? `${totalMs}ms total` : measuredStages.length > 0 ? `${totalMs}ms measured` : "timing not measured";

  return (
    <Card className="relative flex flex-col gap-md overflow-hidden">
      <MediaBackground asset={MEDIA_ASSETS.predictionTimelineLoop} className="opacity-[0.08]" />
      <div className="relative flex items-baseline justify-between">
        <h3>How This Prediction Was Made</h3>
        <span className="text-sm text-muted-foreground">{totalLabel}</span>
      </div>
      <ol className="relative flex flex-col">
        {stages.map((stage, index) => (
          <li key={stage.id} className="flex gap-md">
            <div className="flex flex-col items-center">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-xs font-semibold text-success">
                ✓
              </span>
              {index < stages.length - 1 ? <span className="w-px flex-1 bg-surface-border" /> : null}
            </div>
            <div className="flex flex-1 items-baseline justify-between gap-sm pb-md">
              <div>
                <p className="text-sm font-medium text-foreground">{stage.label}</p>
                <p className="text-sm text-muted-foreground">{stage.description}</p>
              </div>
              <span className="whitespace-nowrap text-sm text-muted-foreground">
                {stage.durationMs !== null ? `${stage.durationMs}ms` : "not measured"}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
