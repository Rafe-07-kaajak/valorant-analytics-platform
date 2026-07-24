import type { KeyFactor } from "@repo/shared";
import { Badge, Card } from "@repo/ui";

export interface KeyFactorsListProps {
  factors: KeyFactor[];
  /** Defaults to "Key Factors" (unchanged from every existing caller) — the real-model result reuses this component with a more specific title (e.g. "Supporting Real Context") to keep it visually distinct from the model's actual driver. */
  title?: string;
}

export function KeyFactorsList({ factors, title = "Key Factors" }: KeyFactorsListProps) {
  if (factors.length === 0) return null;

  return (
    <Card className="flex flex-col gap-md">
      <h3>{title}</h3>
      <ul className="flex flex-col gap-sm">
        {factors.map((factor) => (
          <li key={factor.id} className="flex items-start justify-between gap-sm">
            <div>
              <p className="text-sm font-medium text-foreground">{factor.label}</p>
              <p className="text-sm text-muted-foreground">{factor.description}</p>
            </div>
            <Badge tone={factor.impact === "positive" ? "success" : "danger"}>
              {factor.impact === "positive" ? "+" : "−"}
              {Math.round(factor.magnitude)}
            </Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}
