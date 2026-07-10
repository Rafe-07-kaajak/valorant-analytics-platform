import { Card } from "@repo/ui";

export interface ExplanationCardProps {
  explanation: string;
}

export function ExplanationCard({ explanation }: ExplanationCardProps) {
  return (
    <Card className="flex flex-col gap-2xs">
      <h3>Why This Prediction</h3>
      <p className="text-muted-foreground">{explanation}</p>
    </Card>
  );
}
