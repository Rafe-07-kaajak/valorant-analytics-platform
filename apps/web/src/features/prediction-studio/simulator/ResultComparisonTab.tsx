"use client";

import type { PredictionResult } from "@repo/shared";
import { Badge, Spinner, cn } from "@repo/ui";
import type { SimulatorController } from "./useSimulatorState";
import { buildSimulationSummary, compareOutcomes, type ProbabilityComparison } from "../../../lib/whatIfSimulator";

export interface ResultComparisonTabProps {
  baseline: PredictionResult;
  teamAName: string;
  teamBName: string;
  controller: SimulatorController;
}

export function ResultComparisonTab({ baseline, teamAName, teamBName, controller }: ResultComparisonTabProps) {
  if (!controller.simulationResult) {
    if (controller.status === "loading") {
      return (
        <p className="flex items-center gap-2xs text-sm text-muted-foreground">
          <Spinner size={14} label="Running simulation" />
          Running your first simulation…
        </p>
      );
    }
    return (
      <p className="text-sm text-muted-foreground">
        Adjust attributes in the Controls tab and press Run Simulation to compare a hypothetical result against
        the baseline prediction above.
      </p>
    );
  }

  const simulated = controller.simulationResult.result;
  const comparison = compareOutcomes(baseline, simulated);
  const summary = buildSimulationSummary(comparison, teamAName, teamBName);
  const isStale = controller.status === "loading";

  return (
    <div className="flex flex-col gap-md">
      {isStale ? (
        <p className="flex items-center gap-2xs text-xs text-muted-foreground">
          <Spinner size={12} label="Running a new simulation" />
          Showing the previous simulation while a new one runs…
        </p>
      ) : null}

      <p className="text-sm text-foreground">{summary}</p>

      <div>
        {comparison.winnerChanged ? (
          <Badge tone="brand">Projected winner changed</Badge>
        ) : (
          <Badge tone="neutral">Projected winner unchanged</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <ProbabilityCard
          teamName={teamAName}
          accent="team-a"
          baselinePoints={comparison.baselineTeamAProbabilityPoints}
          simulatedPoints={comparison.simulatedTeamAProbabilityPoints}
          deltaPoints={comparison.teamAProbabilityDeltaPoints}
        />
        <ProbabilityCard
          teamName={teamBName}
          accent="team-b"
          baselinePoints={comparison.baselineTeamBProbabilityPoints}
          simulatedPoints={comparison.simulatedTeamBProbabilityPoints}
          deltaPoints={comparison.teamBProbabilityDeltaPoints}
        />
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <MetricRow label="Confidence" baseline={comparison.baselineConfidence} simulated={comparison.simulatedConfidence} deltaPoints={comparison.confidenceDeltaPoints} />
        <MetricRow label="Trust Score" baseline={comparison.baselineTrustScore} simulated={comparison.simulatedTrustScore} deltaPoints={comparison.trustScoreDeltaPoints} />
      </div>
    </div>
  );
}

function formatDeltaPoints(value: number): string {
  if (value === 0) return "±0.0";
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

function ProbabilityCard({
  teamName,
  accent,
  baselinePoints,
  simulatedPoints,
  deltaPoints,
}: {
  teamName: string;
  accent: "team-a" | "team-b";
  baselinePoints: number;
  simulatedPoints: number;
  deltaPoints: ProbabilityComparison["teamAProbabilityDeltaPoints"];
}) {
  return (
    <div className="flex flex-col gap-3xs rounded-md border border-surface-border bg-surface p-sm">
      <span className="flex items-center gap-2xs text-sm font-semibold text-foreground">
        {/* A colored dot rather than colored text — text-team-a/text-team-b fails WCAG AA
            contrast against the surface background at this size/weight; same precedent as
            SelectedTeamSummary/TeamDnaCard. */}
        <span
          className={cn("inline-block size-2.5 rounded-full", accent === "team-a" ? "bg-team-a" : "bg-team-b")}
          aria-hidden="true"
        />
        {teamName}
      </span>
      <span className="text-xs text-muted-foreground">Baseline win probability: {baselinePoints.toFixed(1)}%</span>
      <span className="text-xs text-muted-foreground">Simulated win probability: {simulatedPoints.toFixed(1)}%</span>
      <span className="text-sm font-semibold text-foreground">{formatDeltaPoints(deltaPoints)} percentage points</span>
    </div>
  );
}

function MetricRow({ label, baseline, simulated, deltaPoints }: { label: string; baseline: number; simulated: number; deltaPoints: number }) {
  const deltaText = deltaPoints === 0 ? "±0" : deltaPoints > 0 ? `+${deltaPoints}` : `${deltaPoints}`;
  return (
    <div className="flex flex-col gap-3xs rounded-md border border-surface-border bg-surface p-sm">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">
        Baseline {baseline} · Simulated {simulated} · {deltaText}
      </span>
    </div>
  );
}
