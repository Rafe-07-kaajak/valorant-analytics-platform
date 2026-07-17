import type { Team, TeamDna } from "@repo/shared";
import { DnaComparisonRadar } from "../match-dna/DnaComparisonRadar";
import { AdvantageBadge } from "./AdvantageBadge";
import type { ComparisonMetric } from "../../lib/teamComparison";

export interface TeamDnaTabProps {
  teamA: Team;
  teamADna: TeamDna;
  teamB: Team;
  teamBDna: TeamDna;
  dimensionRows: ComparisonMetric[];
}

/**
 * The radar chart is paired with a plain, always-visible table carrying the
 * exact same numbers — a text alternative per dimension rather than relying
 * on the SVG alone, so the comparison is fully readable without the chart.
 */
export function TeamDnaTab({ teamA, teamADna, teamB, teamBDna, dimensionRows }: TeamDnaTabProps) {
  const strongerForA = dimensionRows.filter((row) => row.advantage === "A");
  const strongerForB = dimensionRows.filter((row) => row.advantage === "B");
  const balanced = dimensionRows.filter((row) => row.advantage === "even");

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex justify-center">
        <DnaComparisonRadar teamA={teamA} teamADna={teamADna} teamB={teamB} teamBDna={teamBDna} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[24rem] border-collapse text-sm">
          <caption className="sr-only">
            Team DNA dimension values for {teamA.name} and {teamB.name} — a text alternative to the radar
            chart above.
          </caption>
          <thead>
            <tr className="border-b border-surface-border text-left text-muted-foreground">
              <th scope="col" className="py-2xs pr-sm font-medium">
                Dimension
              </th>
              <th scope="col" className="py-2xs pr-sm font-medium">
                {teamA.name}
              </th>
              <th scope="col" className="py-2xs pr-sm font-medium">
                {teamB.name}
              </th>
              <th scope="col" className="py-2xs font-medium">
                Difference
              </th>
            </tr>
          </thead>
          <tbody>
            {dimensionRows.map((row) => (
              <tr key={row.key} className="border-b border-surface-border/60 last:border-0 hover:bg-surface-border/30">
                <th scope="row" className="py-2xs pr-sm text-left font-medium text-foreground">
                  {row.label}
                </th>
                <td className="py-2xs pr-sm text-foreground">{Math.round(row.valueA)}</td>
                <td className="py-2xs pr-sm text-foreground">{Math.round(row.valueB)}</td>
                <td className="py-2xs">
                  <AdvantageBadge
                    advantage={row.advantage}
                    tier={row.tier}
                    teamAName={teamA.name}
                    teamBName={teamB.name}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
        <DnaSummaryList title={`${teamA.name} is stronger in`} rows={strongerForA} />
        <DnaSummaryList title={`${teamB.name} is stronger in`} rows={strongerForB} />
        <DnaSummaryList title="Balanced dimensions" rows={balanced} />
      </div>
    </div>
  );
}

function DnaSummaryList({ title, rows }: { title: string; rows: ComparisonMetric[] }) {
  return (
    <div className="flex flex-col gap-2xs rounded-md border border-surface-border bg-surface p-sm">
      <span className="text-sm font-medium text-foreground">{title}</span>
      {rows.length === 0 ? (
        <span className="text-sm text-muted-foreground">None</span>
      ) : (
        <ul className="flex flex-col gap-3xs text-sm text-muted-foreground">
          {rows.map((row) => (
            <li key={row.key}>{row.label}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
