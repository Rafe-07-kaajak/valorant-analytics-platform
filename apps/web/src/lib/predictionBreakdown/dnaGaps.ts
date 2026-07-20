import type { TeamDna } from "@repo/shared";
import { compareDnaDimensions } from "../teamComparison";
import type { DnaGapRow } from "./types";

/**
 * Reuses TASK-035's `compareDnaDimensions` directly rather than
 * reimplementing dimension-gap classification — same thresholds, same
 * rounding, same "even" handling. Returns rows in `teamADna`'s dimension
 * order (the canonical `DnaDimensionKey` order).
 */
export function buildDnaGapRows(teamADna: TeamDna, teamBDna: TeamDna): DnaGapRow[] {
  return compareDnaDimensions(teamADna, teamBDna) as DnaGapRow[];
}

/** The `count` largest-gap dimensions, largest first, alphabetical-by-label tie-break. */
export function findLargestGapDimensions(rows: readonly DnaGapRow[], count = 2): DnaGapRow[] {
  return [...rows]
    .sort((a, b) => b.magnitude - a.magnitude || a.label.localeCompare(b.label))
    .slice(0, count);
}

function qualifierFor(tier: DnaGapRow["tier"]): string {
  return tier === "strong" ? "notably" : tier === "moderate" ? "moderately" : "slightly";
}

/**
 * A short, deterministic sentence summarizing the largest DNA gaps — same
 * qualifier-record pattern as TASK-036's `explainMapMatchup`. Supports the
 * fully-balanced case explicitly rather than forcing a claim.
 */
export function explainLargestGaps(rows: readonly DnaGapRow[], teamAName: string, teamBName: string): string {
  const largest = findLargestGapDimensions(rows, 2).filter((row) => row.advantage !== "even");

  if (largest.length === 0) {
    return `${teamAName} and ${teamBName} show a similar modeled profile across every tracked Team DNA dimension.`;
  }

  const forA = largest.filter((row) => row.advantage === "A");
  const forB = largest.filter((row) => row.advantage === "B");

  const clause = (team: string, dims: DnaGapRow[]) =>
    dims.length === 0
      ? null
      : `${team} leads ${qualifierFor(dims[0]!.tier)} in ${dims.map((row) => row.label.toLowerCase()).join(" and ")}`;

  const clauses = [clause(teamAName, forA), clause(teamBName, forB)].filter((value): value is string => Boolean(value));
  return `${clauses.join(", while ")}. These are the largest modeled differences between these two teams.`;
}
