import { Card } from "@repo/ui";

export interface ComparisonEmptyStateProps {
  /** "none" — neither side selected yet. "partial" — exactly one side selected. */
  stage: "none" | "partial";
  /** Name of the side that IS selected, only used when stage is "partial". */
  selectedTeamName?: string;
  selectedSide?: "A" | "B";
}

export function ComparisonEmptyState({ stage, selectedTeamName, selectedSide }: ComparisonEmptyStateProps) {
  if (stage === "partial" && selectedTeamName && selectedSide) {
    const opposingSide = selectedSide === "A" ? "B" : "A";
    return (
      <Card className="flex flex-col gap-2xs">
        <p className="font-medium text-foreground">{selectedTeamName} is selected for Team {selectedSide}.</p>
        <p className="text-sm text-muted-foreground">
          Choose a region and team for Team {opposingSide} above to see the modeled comparison.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-2xs">
      <p className="font-medium text-foreground">Select a team for each side to begin.</p>
      <p className="text-sm text-muted-foreground">
        The Comparison Lab compares two teams&apos; modeled profiles directly — overall rating, Team DNA,
        map strength, and the biggest differences between them — without generating a match prediction first.
      </p>
    </Card>
  );
}
