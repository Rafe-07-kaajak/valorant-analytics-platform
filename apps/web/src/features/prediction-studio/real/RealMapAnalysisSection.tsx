import type { CurrentPredictionResponse } from "@repo/shared";
import { Badge, Card } from "@repo/ui";

export interface RealMapAnalysisSectionProps {
  result: CurrentPredictionResponse;
  teamAName: string;
  teamBName: string;
}

const EVIDENCE_LABEL: Record<CurrentPredictionResponse["mapEvidence"]["evidenceLevel"], string> = {
  sufficient: "Sufficient real evidence",
  limited: "Limited real evidence",
  none: "No real map-specific evidence",
};

const EVIDENCE_TONE: Record<CurrentPredictionResponse["mapEvidence"]["evidenceLevel"], "success" | "info" | "danger"> = {
  sufficient: "success",
  limited: "info",
  none: "danger",
};

/**
 * Real Model equivalent of the synthetic per-map exploration. The real
 * feature catalog has no per-map breakdown (see
 * `services/vlr-ingestion/src/feature/featureCatalog.ts`), so this is always
 * pool-wide aggregate evidence, never a fabricated per-selected-map score.
 * `evidenceLevel` is shown up front so a low-sample matchup is never
 * presented with the same visual confidence as a well-sampled one.
 */
export function RealMapAnalysisSection({ result, teamAName, teamBName }: RealMapAnalysisSectionProps) {
  const { mapEvidence } = result;

  return (
    <Card className="flex flex-col gap-md">
      <div className="flex items-center justify-between gap-sm">
        <h3>Map Coverage</h3>
        <Badge tone={EVIDENCE_TONE[mapEvidence.evidenceLevel]}>{EVIDENCE_LABEL[mapEvidence.evidenceLevel]}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Aggregate real map statistics only. The real feature catalog has no per-map breakdown, so no
        per-selected-map score is shown.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[24rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-muted-foreground">
              <th scope="col" className="py-2xs pr-sm font-medium">
                Metric
              </th>
              <th scope="col" className="py-2xs pr-sm font-medium">
                {teamAName}
              </th>
              <th scope="col" className="py-2xs font-medium">
                {teamBName}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-surface-border/60">
              <th scope="row" className="py-2xs pr-sm text-left font-medium text-foreground">
                Map Pool Breadth
              </th>
              <td className="py-2xs pr-sm text-foreground">{mapEvidence.teamAMapPoolBreadth}</td>
              <td className="py-2xs text-foreground">{mapEvidence.teamBMapPoolBreadth}</td>
            </tr>
            <tr className="border-b border-surface-border/60">
              <th scope="row" className="py-2xs pr-sm text-left font-medium text-foreground">
                Recent Map Win Rate (last 10)
              </th>
              <td className="py-2xs pr-sm text-foreground">{(mapEvidence.teamARecentMapWinRate * 100).toFixed(1)}%</td>
              <td className="py-2xs text-foreground">{(mapEvidence.teamBRecentMapWinRate * 100).toFixed(1)}%</td>
            </tr>
            <tr className="border-b border-surface-border/60">
              <th scope="row" className="py-2xs pr-sm text-left font-medium text-foreground">
                Cumulative Map Win Rate
              </th>
              <td className="py-2xs pr-sm text-foreground">{(mapEvidence.teamACumulativeMapWinRate * 100).toFixed(1)}%</td>
              <td className="py-2xs text-foreground">{(mapEvidence.teamBCumulativeMapWinRate * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <th scope="row" className="py-2xs pr-sm text-left font-medium text-foreground">
                Avg. Rounds Won / Lost Per Map
              </th>
              <td className="py-2xs pr-sm text-foreground">
                {mapEvidence.teamAAvgRoundsWonPerMap.toFixed(1)} / {mapEvidence.teamAAvgRoundsLostPerMap.toFixed(1)}
              </td>
              <td className="py-2xs text-foreground">
                {mapEvidence.teamBAvgRoundsWonPerMap.toFixed(1)} / {mapEvidence.teamBAvgRoundsLostPerMap.toFixed(1)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Known map pool overlap: {mapEvidence.knownMapPoolOverlapCount} map(s). Aggregate map strength
        differential: {mapEvidence.mapStrengthDifferential >= 0 ? "+" : ""}
        {(mapEvidence.mapStrengthDifferential * 100).toFixed(1)} points.
      </p>
    </Card>
  );
}
