"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import type { CurrentPredictionResponse } from "@repo/shared";
import { Badge, Button, Card, Slider, SplitBar, cn } from "@repo/ui";
import { expectedWinProbabilityFromElo } from "./eloSensitivity";

export interface RealContextSimulatorProps {
  result: CurrentPredictionResponse;
  teamAName: string;
  teamBName: string;
}

const ELO_DELTA_MIN = -200;
const ELO_DELTA_MAX = 200;
const ELO_DELTA_STEP = 10;

type InertToggleOption<T extends string> = { value: T; label: string };

function InertToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly InertToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const labelId = `real-simulator-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="flex flex-col gap-2xs">
      <span id={labelId} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className="inline-flex w-fit rounded-md border border-surface-border bg-surface p-[3px]">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-sm px-3 py-1.5 text-sm font-medium motion-safe:transition-colors motion-safe:duration-(--duration-fast) motion-safe:ease-(--ease-standard)",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                active ? "bg-brand-500 text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Real Model equivalent of the synthetic What-if Simulator. Deliberately does
 * NOT route through the synthetic engine or any API call — the deployed
 * `elo-baseline` estimator consumes exactly one real signal (Elo), so the
 * only genuinely probability-changing control is "Elo Sensitivity" (pure
 * client-side math, the identical real Elo formula the model itself runs,
 * see `eloSensitivity.ts`). Every other control here (tournament context,
 * series format) is honestly labeled as non-probability-changing, per the
 * task brief's explicit instruction not to expose an unconsumed metric as a
 * probability-changing slider. The baseline result above never changes;
 * this section renders its own, clearly separate "Hypothetical" panel that
 * only appears after the user presses "Preview Hypothetical".
 */
export function RealContextSimulator({ result, teamAName, teamBName }: RealContextSimulatorProps) {
  const { teamAState, teamBState } = result;
  const [eloDeltaA, setEloDeltaA] = useState(0);
  const [eloDeltaB, setEloDeltaB] = useState(0);
  const [tier, setTier] = useState<"league" | "international">(result.tournamentTier);
  const [format, setFormat] = useState<"bo3" | "bo5">(result.seriesFormat === "BO5" ? "bo5" : "bo3");
  const [hasRun, setHasRun] = useState(false);

  const hypotheticalEloA = teamAState.eloRating + eloDeltaA;
  const hypotheticalEloB = teamBState.eloRating + eloDeltaB;
  const hypotheticalProbabilityA = expectedWinProbabilityFromElo(hypotheticalEloA, hypotheticalEloB);
  const baselineProbabilityA = result.contribution.uncalibratedProbability;
  const deltaPoints = Math.round((hypotheticalProbabilityA - baselineProbabilityA) * 1000) / 10;

  const resetAll = () => {
    setEloDeltaA(0);
    setEloDeltaB(0);
    setHasRun(false);
  };

  return (
    <Card className="flex flex-col gap-md">
      <h3>Real Context Simulator</h3>
      <p className="text-sm text-muted-foreground">
        Explore hypothetical inputs for the currently selected {result.estimatorType} estimator. The prediction
        above never changes here; every result below is a labeled hypothetical.
      </p>

      <div className="flex flex-col gap-sm rounded-md border border-surface-border bg-surface p-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Elo Sensitivity (real, probability-changing)</span>
        <div className="flex flex-col gap-3xs">
          <div className="flex flex-wrap items-baseline justify-between gap-2xs">
            <label htmlFor="elo-delta-a" className="text-sm font-medium text-foreground">
              {teamAName} Elo adjustment
            </label>
            <span className="text-xs text-muted-foreground">
              Baseline {Math.round(teamAState.eloRating)} &middot; {eloDeltaA >= 0 ? `+${eloDeltaA}` : eloDeltaA} &middot; Hypothetical{" "}
              {Math.round(hypotheticalEloA)}
            </span>
          </div>
          <Slider
            id="elo-delta-a"
            min={ELO_DELTA_MIN}
            max={ELO_DELTA_MAX}
            step={ELO_DELTA_STEP}
            value={eloDeltaA}
            aria-label={`${teamAName} hypothetical Elo adjustment`}
            onChange={(event) => setEloDeltaA(Number(event.target.value))}
            className="accent-team-a"
          />
        </div>
        <div className="flex flex-col gap-3xs">
          <div className="flex flex-wrap items-baseline justify-between gap-2xs">
            <label htmlFor="elo-delta-b" className="text-sm font-medium text-foreground">
              {teamBName} Elo adjustment
            </label>
            <span className="text-xs text-muted-foreground">
              Baseline {Math.round(teamBState.eloRating)} &middot; {eloDeltaB >= 0 ? `+${eloDeltaB}` : eloDeltaB} &middot; Hypothetical{" "}
              {Math.round(hypotheticalEloB)}
            </span>
          </div>
          <Slider
            id="elo-delta-b"
            min={ELO_DELTA_MIN}
            max={ELO_DELTA_MAX}
            step={ELO_DELTA_STEP}
            value={eloDeltaB}
            aria-label={`${teamBName} hypothetical Elo adjustment`}
            onChange={(event) => setEloDeltaB(Number(event.target.value))}
            className="accent-team-b"
          />
        </div>

        <div className="flex items-center gap-sm">
          <Button type="button" onClick={() => setHasRun(true)} disabled={eloDeltaA === 0 && eloDeltaB === 0}>
            Preview Hypothetical
          </Button>
          <button
            type="button"
            onClick={resetAll}
            disabled={eloDeltaA === 0 && eloDeltaB === 0 && !hasRun}
            aria-label="Reset Elo sensitivity to baseline"
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-muted-foreground",
              "transition-colors duration-(--duration-fast) ease-(--ease-standard)",
              "hover:text-foreground disabled:pointer-events-none disabled:opacity-30",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
            )}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
          </button>
        </div>

        {hasRun ? (
          <div className="flex flex-col gap-2xs rounded-md border border-brand-400/40 bg-brand-400/5 p-sm" role="status">
            <Badge tone="brand">Hypothetical, not applied</Badge>
            <SplitBar
              segments={[
                { id: "teamA", label: teamAName, value: hypotheticalProbabilityA, color: "var(--team-a)" },
                { id: "teamB", label: teamBName, value: 1 - hypotheticalProbabilityA, color: "var(--team-b)" },
              ]}
            />
            <p className="text-sm text-foreground">
              Hypothetical uncalibrated probability: {(hypotheticalProbabilityA * 100).toFixed(1)}% for {teamAName} (
              {deltaPoints >= 0 ? "+" : ""}
              {deltaPoints.toFixed(1)} points vs. the real baseline).
            </p>
            <p className="text-xs text-muted-foreground">
              This is the raw Elo formula result only. The actual served prediction also applies calibration
              (current method: {result.calibrationMethod}), which this preview does not simulate.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-md rounded-md border border-surface-border bg-surface p-sm">
        <InertToggle label="Tournament Context" options={[{ value: "league", label: "Regional Season" }, { value: "international", label: "International" }] as const} value={tier} onChange={setTier} />
        <InertToggle label="Series Format" options={[{ value: "bo3", label: "BO3" }, { value: "bo5", label: "BO5" }] as const} value={format} onChange={setFormat} />
        <p className="w-full text-xs text-muted-foreground">
          Contextual exploration only. The currently selected {result.estimatorType} estimator does not consume
          tournament context or series format, so changing these does not change the prediction above.
        </p>
      </div>
    </Card>
  );
}
