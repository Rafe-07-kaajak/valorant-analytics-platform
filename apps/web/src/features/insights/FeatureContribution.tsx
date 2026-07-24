import type { KeyFactor } from "@repo/shared";
import { Card, Meter } from "@repo/ui";

export interface FeatureContributionProps {
  factors: KeyFactor[];
  /** Defaults to "Feature Contribution" (unchanged from every existing caller) — the real-model result reuses this component with a more specific title to separate the model's one actual driver from non-driving supporting context. */
  title?: string;
}

export function FeatureContribution({ factors, title = "Feature Contribution" }: FeatureContributionProps) {
  if (factors.length === 0) return null;

  return (
    <Card className="flex flex-col gap-md">
      <h3>{title}</h3>
      <div className="flex flex-col gap-sm">
        {factors.map((factor) => (
          <Meter
            key={factor.id}
            label={factor.label}
            value={factor.magnitude}
            valueLabel={`${factor.impact === "positive" ? "+" : "−"}${Math.round(factor.magnitude)}`}
            tone={factor.impact === "positive" ? "success" : "danger"}
          />
        ))}
      </div>
    </Card>
  );
}
