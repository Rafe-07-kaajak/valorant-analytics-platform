"use client";

import type { PredictionResult } from "@repo/shared";
import type { SimulatorController } from "./useSimulatorState";
import { diffContributions, diffKeyFactors, diffMatchDna, fromProfileAdjustment, summarizeAdjustments } from "../../../lib/whatIfSimulator";

export interface ChangeBreakdownTabProps {
  baseline: PredictionResult;
  teamAId: string;
  teamAName: string;
  teamBName: string;
  mapLabel: (mapId: string) => string;
  controller: SimulatorController;
}

function formatDelta(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function ChangeBreakdownTab({ baseline, teamAId, teamAName, teamBName, mapLabel, controller }: ChangeBreakdownTabProps) {
  if (!controller.simulationResult) {
    return (
      <p className="text-sm text-muted-foreground">
        Run a simulation from the Controls tab to see how contributions, key factors, and Match DNA compare
        against the baseline.
      </p>
    );
  }

  const { result: simulated, teamAAdjustment, teamBAdjustment } = controller.simulationResult;

  const contributionChanges = diffContributions(baseline, simulated, teamAId).filter((change) => change.shareDeltaPoints !== 0);
  const keyFactorChanges = diffKeyFactors(baseline, simulated).filter((change) => change.status !== "unchanged");
  const dnaComparison = diffMatchDna(baseline, simulated);

  const appliedSummary = summarizeAdjustments(
    teamAName,
    teamBName,
    fromProfileAdjustment(teamAAdjustment),
    fromProfileAdjustment(teamBAdjustment),
    teamAAdjustment.mapStrength,
    teamBAdjustment.mapStrength,
    mapLabel,
  );

  return (
    <div className="flex flex-col gap-lg">
      <section className="flex flex-col gap-2xs">
        <h5 className="text-sm font-semibold text-foreground">Applied adjustments</h5>
        <p className="text-sm text-muted-foreground">{appliedSummary}</p>
      </section>

      <section className="flex flex-col gap-2xs">
        <h5 className="text-sm font-semibold text-foreground">Contribution changes</h5>
        {contributionChanges.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contribution shares changed.</p>
        ) : (
          <ul className="flex flex-col gap-2xs" aria-label="Contribution changes">
            {contributionChanges.map((change) => (
              <li key={change.id} className="text-sm text-foreground">
                {change.label}: {change.baselineShareOfTotal ?? 0}% → {change.simulatedShareOfTotal ?? 0}% (
                {formatDelta(change.shareDeltaPoints)} points)
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2xs">
        <h5 className="text-sm font-semibold text-foreground">Key factor changes</h5>
        {keyFactorChanges.length === 0 ? (
          <p className="text-sm text-muted-foreground">The set of key factors and their magnitudes are unchanged.</p>
        ) : (
          <ul className="flex flex-col gap-2xs" aria-label="Key factor changes">
            {keyFactorChanges.map((change) => (
              <li key={change.id} className="text-sm text-foreground">
                {change.label}:{" "}
                {change.status === "new"
                  ? `newly a key factor (magnitude ${change.simulatedMagnitude})`
                  : change.status === "removed"
                    ? "no longer a key factor"
                    : `magnitude ${change.baselineMagnitude} → ${change.simulatedMagnitude} (${formatDelta(change.magnitudeDeltaPoints)})`}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2xs">
        <h5 className="text-sm font-semibold text-foreground">Match DNA changes</h5>
        <p className="text-sm text-muted-foreground">
          Similarity score: {dnaComparison.baselineSimilarityScore} → {dnaComparison.simulatedSimilarityScore} (
          {formatDelta(dnaComparison.similarityScoreDeltaPoints)})
          {dnaComparison.decisiveTraitChanged ? ", decisive trait changed" : ""}
        </p>
        {dnaComparison.dimensionChanges.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Team DNA dimension changed.</p>
        ) : (
          <ul className="flex flex-col gap-2xs" aria-label="Match DNA dimension changes">
            {dnaComparison.dimensionChanges.map((change) => (
              <li key={`${change.teamId}-${change.key}`} className="text-sm text-foreground">
                {change.teamId === teamAId ? teamAName : teamBName} {change.label}: {change.baselineValue} → {change.simulatedValue} (
                {formatDelta(change.deltaPoints)})
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
