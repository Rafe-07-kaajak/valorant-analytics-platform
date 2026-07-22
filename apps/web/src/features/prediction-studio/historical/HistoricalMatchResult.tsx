import type { CSSProperties } from "react";
import { AlertTriangle, Archive, EyeOff, Fingerprint } from "lucide-react";
import type { HistoricalPredictionResponse } from "@repo/shared";
import { Badge, Card, SplitBar } from "@repo/ui";

export interface HistoricalMatchResultProps {
  result: HistoricalPredictionResponse;
}

function formatPercent(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

function formatMatchContext(match: HistoricalPredictionResponse["match"]): string {
  const date = new Date(match.scheduledAt);
  const dateLabel = Number.isNaN(date.getTime())
    ? match.scheduledAt
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  return `${dateLabel} · ${match.eventFamily} · ${match.eventRegion} · ${match.tournamentLevel} · ${match.seriesFormat}`;
}

/**
 * Restrained real-model result display -- TASK-047 requirement 13, redesigned
 * for TASK-056. Still shows only probability, predicted side, confidence, and
 * model provenance; never fabricates feature importance for the Elo model.
 * `resultAvailability.actualResultRevealable` is rendered honestly (it is
 * always `false` today -- docs/35, "No actual-outcome reveal") rather than
 * building a prediction-vs-actual comparison the backend has no data for.
 */
export function HistoricalMatchResult({ result }: HistoricalMatchResultProps) {
  const predictedTeamLabel = result.predictedWinnerSide === "teamA" ? "Team A" : "Team B";

  return (
    <Card
      variant="result"
      style={{ "--border-accent": "var(--color-accent-amber)" } as CSSProperties}
      className="flex flex-col gap-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <div className="flex flex-col gap-3xs">
          <div className="flex items-center gap-2xs">
            <Archive aria-hidden="true" className="size-4 text-(--color-accent-amber)" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Replay result</span>
          </div>
          <h3 className="text-lg font-semibold text-foreground">{formatMatchContext(result.match)}</h3>
        </div>
        <Badge tone="brand">Real trained model</Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Known at prediction time: information available before this match was played. Not a live or future forecast.
      </p>

      <div className="flex flex-col gap-2xs rounded-md border border-surface-border bg-surface-raised p-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historical prediction</span>
        <SplitBar
          segments={[
            { id: "teamA", label: "Team A", value: result.teamAWinProbability, color: "var(--team-a)" },
            { id: "teamB", label: "Team B", value: result.teamBWinProbability, color: "var(--team-b)" },
          ]}
        />
        <p className="text-sm text-foreground">
          Predicted side: <span className="font-medium">{predictedTeamLabel}</span>{" "}
          <span className="text-muted-foreground">(confidence {formatPercent(result.confidence)})</span>
        </p>
      </div>

      <div className="flex items-start gap-2xs rounded-md border border-surface-border bg-surface p-sm">
        <EyeOff aria-hidden="true" className="mt-[2px] size-4 shrink-0 text-muted-foreground" />
        <div className="flex flex-col gap-3xs">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actual outcome</span>
          <p className="text-sm text-muted-foreground">
            {result.resultAvailability.actualResultRevealable
              ? "The actual result is available but reveal is not yet built into this view."
              : "Actual outcome reveal is not available in this release."}
          </p>
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
          <dt>Feature schema</dt>
          <dd className="truncate font-mono text-foreground">{result.featureSchemaVersion}</dd>
          <dt>Generated</dt>
          <dd className="text-foreground">{new Date(result.predictionGeneratedAt).toLocaleString()}</dd>
        </dl>
      </details>

      <p className="text-xs text-muted-foreground">
        This replay uses the archived model and data snapshot available at the selected historical point.
      </p>

      {result.warnings.length > 0 ? (
        <ul className="flex flex-col gap-3xs">
          {result.warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2xs text-xs text-warning">
              <AlertTriangle aria-hidden="true" className="mt-[2px] size-3.5 shrink-0" />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
