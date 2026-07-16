import type { KeyFactor } from "@repo/shared";
import { Card, Meter } from "@repo/ui";

export interface FeatureContributionProps {
  factors: KeyFactor[];
}

export function FeatureContribution({ factors }: FeatureContributionProps) {
  if (factors.length === 0) return null;

  return (
    <Card className="flex flex-col gap-md">
      <h3>Feature Contribution</h3>
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
