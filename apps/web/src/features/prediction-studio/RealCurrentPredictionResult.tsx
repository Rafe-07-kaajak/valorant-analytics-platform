"use client";

import type { CSSProperties } from "react";
import { AlertTriangle, Cpu, Fingerprint } from "lucide-react";
import type { CurrentPredictionResponse } from "@repo/shared";
import { Badge, Card, SplitBar } from "@repo/ui";
import type { VctTeam } from "../../constants/vct";
import { DataConfidenceBadge } from "../power-rankings/DataConfidenceBadge";
import { ExplanationCard } from "../insights/ExplanationCard";
import { KeyFactorsList } from "../insights/KeyFactorsList";
import { FeatureContribution } from "../insights/FeatureContribution";
import { InsightsList } from "../insights/InsightsList";
import { RealPredictionBreakdown } from "./real/RealPredictionBreakdown";
import { RealContextSimulator } from "./real/RealContextSimulator";
import { RealTeamStateSection } from "./real/RealTeamStateSection";
import { RealMapAnalysisSection } from "./real/RealMapAnalysisSection";
import { RealPipelineTimeline } from "./real/RealPipelineTimeline";
import { useRealBreakdownState } from "./real/useRealBreakdownState";
import { buildDriverKeyFactor, buildRealExplanation, buildRealInsights, buildSupportingContextFactors } from "./real/realViewModels";

export interface RealCurrentPredictionResultProps {
  result: CurrentPredictionResponse;
  teamA: VctTeam;
  teamB: VctTeam;
}

function formatPercent(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

function formatDateOnly(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Real-model UX-parity task: the main-flow counterpart to the synthetic
 * `PredictionResultExperience.tsx`, built to the same analytical depth and
 * section hierarchy (winner hero, probability, confidence/evidence,
 * interactive breakdown, team state, context simulator, explanation, key
 * factors, insights, pipeline, disclosure, warnings), while every value
 * shown remains traceable to real ingested match data, real engineered
 * features, or the selected runtime model artifact. Always rendered instead
 * of (never alongside, never falling back from/to) `PredictionResultExperience`,
 * the synthetic-scenario result.
 */
export function RealCurrentPredictionResult({ result, teamA, teamB }: RealCurrentPredictionResultProps) {
  const breakdown = useRealBreakdownState();
  const predictedTeamLabel = result.predictedWinnerSide === "teamA" ? teamA.name : teamB.name;

  const driverFactor = buildDriverKeyFactor(result, teamA.name, teamB.name);
  const contextFactors = buildSupportingContextFactors(result.supportingContext);
  const insights = buildRealInsights(result);
  const explanation = buildRealExplanation(result, teamA.name, teamB.name);

  return (
    <div className="flex flex-col gap-lg motion-safe:transition-[opacity,transform] motion-safe:duration-(--duration-panel) motion-safe:ease-(--ease-standard) motion-safe:starting:translate-y-2 motion-safe:starting:opacity-0">
      <Card
        variant="result"
        style={{ "--border-accent": "var(--color-accent-amber)" } as CSSProperties}
        className="flex flex-col gap-md"
      >
        <div className="flex flex-wrap items-start justify-between gap-sm">
          <div className="flex flex-col gap-3xs">
            <div className="flex items-center gap-2xs">
              <Cpu aria-hidden="true" className="size-4 text-(--color-accent-amber)" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Real-model prediction</span>
            </div>
            <div className="flex flex-wrap items-center gap-2xs">
              <Badge tone="brand">Real Model Favorite</Badge>
              {result.confidence >= 0.8 ? <Badge tone="success">High Confidence</Badge> : null}
            </div>
            <h2 className="text-lg font-semibold text-foreground">{predictedTeamLabel}</h2>
            <p className="text-sm text-muted-foreground">
              {teamA.name} vs {teamB.name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2xs">
            <Badge tone="brand">Real trained model</Badge>
            <Badge tone="neutralStatus">{result.tournamentTier === "international" ? "International (assumed)" : "Regional Season (assumed)"}</Badge>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Constructed from real ingested match data as of {formatDateOnly(result.dataProvenance.asOfIso)}. Not a live
          or future forecast beyond that data; the {result.tournamentTier === "international" ? "International" : "Regional Season"} context
          above is an explicit user assumption, not a scheduled event. Model version shown in Model provenance below.
        </p>

        <div className="flex flex-col gap-2xs rounded-md border border-surface-border bg-surface-raised p-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Predicted outcome</span>
          <SplitBar
            segments={[
              { id: "teamA", label: teamA.name, value: result.teamAWinProbability, color: "var(--team-a)" },
              { id: "teamB", label: teamB.name, value: result.teamBWinProbability, color: "var(--team-b)" },
            ]}
          />
          <p className="text-sm text-foreground">
            Predicted side: <span className="font-medium">{predictedTeamLabel}</span>{" "}
            <span className="text-muted-foreground">
              (model confidence {formatPercent(result.confidence)}, evidence trust {result.evidenceTrust.score}/100)
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-sm rounded-md border border-surface-border bg-surface p-sm">
          <div className="flex flex-col gap-3xs">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{teamA.name} data</span>
            <DataConfidenceBadge confidence={result.teamAConfidence.confidence} seriesCountInWindow={result.teamAConfidence.seriesCountInWindow} />
          </div>
          <div className="flex flex-col gap-3xs">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{teamB.name} data</span>
            <DataConfidenceBadge confidence={result.teamBConfidence.confidence} seriesCountInWindow={result.teamBConfidence.seriesCountInWindow} />
          </div>
        </div>

        <details open className="flex flex-col gap-2xs rounded-md border border-surface-border bg-surface p-sm text-sm">
          <summary className="flex cursor-pointer items-center gap-2xs text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Fingerprint aria-hidden="true" className="size-3.5" />
            Model provenance
          </summary>
          <dl className="grid grid-cols-2 gap-x-md gap-y-2xs pt-2xs text-xs text-muted-foreground">
            <dt>Model version</dt>
            <dd className="truncate font-mono text-foreground">{result.modelVersion}</dd>
            <dt>Estimator</dt>
            <dd className="text-foreground">{result.estimatorType}</dd>
            <dt>Calibration</dt>
            <dd className="text-foreground">{result.calibrationMethod}</dd>
            <dt>Feature dataset</dt>
            <dd className="truncate font-mono text-foreground">{result.dataProvenance.sourceFeatureDatasetVersion}</dd>
            <dt>Canonical window start</dt>
            <dd className="text-foreground">{formatDateOnly(result.dataProvenance.canonicalWindowStartIso)}</dd>
            <dt>Model training cutoff</dt>
            <dd className="text-foreground">{result.dataProvenance.modelTrainDateRangeEndIso ? formatDateOnly(result.dataProvenance.modelTrainDateRangeEndIso) : "Unknown"}</dd>
            <dt>Generated</dt>
            <dd className="text-foreground">{new Date(result.predictionGeneratedAt).toLocaleString()}</dd>
          </dl>
        </details>
      </Card>

      <RealPredictionBreakdown result={result} teamAName={teamA.name} teamBName={teamB.name} breakdown={breakdown} />

      <RealContextSimulator result={result} teamAName={teamA.name} teamBName={teamB.name} />

      <RealTeamStateSection result={result} teamAName={teamA.name} teamBName={teamB.name} />

      <ExplanationCard explanation={explanation} />

      <KeyFactorsList factors={driverFactor} title="Actual Model Driver" />
      <FeatureContribution factors={contextFactors} title="Supporting Real Context" />

      <InsightsList insights={insights} />

      <RealMapAnalysisSection result={result} teamAName={teamA.name} teamBName={teamB.name} />

      <RealPipelineTimeline stages={result.pipeline} />

      {result.warnings.length > 0 ? (
        <ul className="flex flex-col gap-3xs">
          {result.warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2xs text-sm text-warning">
              <AlertTriangle aria-hidden="true" className="mt-[2px] size-3.5 shrink-0" />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
