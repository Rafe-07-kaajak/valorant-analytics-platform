import type { Insight, InsightKind } from "@repo/shared";
import { Badge, Card } from "@repo/ui";

export interface InsightsListProps {
  insights: Insight[];
}

const KIND_LABEL: Record<InsightKind, string> = {
  advantage: "Advantage",
  weakness: "Weakness",
  "deciding-factor": "Deciding Factor",
  confidence: "Confidence",
};

const KIND_TONE: Record<InsightKind, "success" | "danger" | "brand"> = {
  advantage: "success",
  weakness: "danger",
  "deciding-factor": "brand",
  confidence: "brand",
};

export function InsightsList({ insights }: InsightsListProps) {
  return (
    <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
      {insights.map((insight) => (
        <Card key={insight.id} className="flex flex-col gap-2xs">
          <Badge tone={KIND_TONE[insight.kind]}>{KIND_LABEL[insight.kind]}</Badge>
          <p className="font-medium text-foreground">{insight.title}</p>
          <p className="text-sm text-muted-foreground">{insight.description}</p>
        </Card>
      ))}
    </div>
  );
}
