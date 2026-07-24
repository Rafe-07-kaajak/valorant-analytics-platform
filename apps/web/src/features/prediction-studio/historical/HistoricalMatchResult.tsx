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
  return `${dateLabel} · ${match.eventName} · ${match.tournamentLevel} · ${match.matchStageDisplay} · ${match.seriesFormat}`;
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
  const predictedTeamLabel = result.predictedWinnerSide === "teamA" ? result.match.teamADisplayName : result.match.teamBDisplayName;
  const isPointInTime = result.dataProvenance.temporalFidelity === "point-in-time";

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
        <div className="flex flex-wrap items-center gap-2xs">
          <Badge tone="brand">Real trained model</Badge>
          <Badge tone={isPointInTime ? "success" : "info"}>{isPointInTime ? "Point-in-time" : "Retrospective reconstruction"}</Badge>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Known at prediction time: information available before this match was played. Not a live or future forecast.
      </p>

      <div className="flex flex-col gap-2xs rounded-md border border-surface-border bg-surface-raised p-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historical prediction</span>
        <SplitBar
          segments={[
            { id: "teamA", label: result.match.teamADisplayName, value: result.teamAWinProbability, color: "var(--team-a)" },
            { id: "teamB", label: result.match.teamBDisplayName, value: result.teamBWinProbability, color: "var(--team-b)" },
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
        {isPointInTime
          ? "This replay uses the currently active model, which was trained only on data strictly before this match: a genuine point-in-time prediction."
          : "This replay uses the currently active model against this match's real historical data. The model itself was trained on data including this match's own period (or later), so this is a retrospective reconstruction rather than a genuine point-in-time prediction."}
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
