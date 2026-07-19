"use client";

import { useState } from "react";
import { Button, Card, Spinner, Stack } from "@repo/ui";
import { useRealPredictionReadiness } from "../../../hooks/useRealPredictionReadiness";
import { useHistoricalCatalog } from "../../../hooks/useHistoricalCatalog";
import { useHistoricalPrediction } from "../../../hooks/useHistoricalPrediction";
import { HistoricalMatchResult } from "./HistoricalMatchResult";

function formatMatchLabel(scheduledAt: string, eventFamily: string, teamAProviderId: string, teamBProviderId: string): string {
  const date = new Date(scheduledAt);
  const dateLabel = Number.isNaN(date.getTime()) ? scheduledAt : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  return `${dateLabel} · ${eventFamily} · ${teamAProviderId} vs ${teamBProviderId}`;
}

/**
 * TASK-047 UI integration — a separate, always-visible "Historical Model
 * Replay" section rather than a tab that replaces the existing Synthetic
 * Scenario builder. Two reasons: (1) it cannot regress the existing
 * scenario-builder DOM/tests, which interact with region/team controls the
 * instant the page loads (a tab default would need to keep those exact
 * semantics anyway, for no isolation benefit); (2) each mode keeps its own
 * independent result state, so there is no shared result area where a
 * historical prediction and a synthetic one could ever be confused for one
 * another. See docs/35, "UI integration".
 */
export function HistoricalReplaySection() {
  const { status: readinessStatus, readiness, error: readinessError, refresh: refreshReadiness } = useRealPredictionReadiness();
  const catalogEnabled = readiness?.realPredictionAvailable ?? false;
  const { status: catalogStatus, matches, error: catalogError, refresh: refreshCatalog } = useHistoricalCatalog(catalogEnabled);
  const { status: predictionStatus, result, error: predictionError, requestPrediction } = useHistoricalPrediction();
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  function handleSelectMatch(matchInternalId: string) {
    setSelectedMatchId(matchInternalId);
    void requestPrediction(matchInternalId);
  }

  return (
    <Card>
      <Stack gap="sm">
        <div>
          <h2 className="text-lg font-semibold">Historical Model Replay</h2>
          <p className="text-sm text-muted-foreground">
            Select a known historical match to see what the trained model would have predicted using only information available before it was played.
          </p>
        </div>

        {readinessStatus === "loading" ? (
          <div className="flex items-center gap-2xs text-sm text-muted-foreground">
            <Spinner size={14} /> Checking historical model availability…
          </div>
        ) : null}

        {readinessStatus === "error" ? (
          <div className="flex flex-col gap-2xs">
            <p role="alert" className="text-sm text-danger">
              {readinessError ?? "Unable to check historical model availability."}
            </p>
            <Button size="sm" variant="secondary" onClick={() => void refreshReadiness()}>
              Retry
            </Button>
          </div>
        ) : null}

        {readinessStatus === "success" && readiness && !readiness.realPredictionAvailable ? (
          <div className="flex flex-col gap-2xs">
            <p className="text-sm text-muted-foreground">{readiness.message} Synthetic Scenario predictions above remain fully available.</p>
            {readiness.retryable ? (
              <Button size="sm" variant="secondary" onClick={() => void refreshReadiness()}>
                Retry
              </Button>
            ) : null}
          </div>
        ) : null}

        {readinessStatus === "success" && readiness?.realPredictionAvailable ? (
          <>
            {catalogStatus === "loading" ? (
              <div className="flex items-center gap-2xs text-sm text-muted-foreground">
                <Spinner size={14} /> Loading historical matches…
              </div>
            ) : null}

            {catalogStatus === "error" ? (
              <div className="flex flex-col gap-2xs">
                <p role="alert" className="text-sm text-danger">
                  {catalogError ?? "Unable to load historical matches."}
                </p>
                <Button size="sm" variant="secondary" onClick={() => void refreshCatalog()}>
                  Retry
                </Button>
              </div>
            ) : null}

            {catalogStatus === "success" && matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No historical matches are available for replay yet.</p>
            ) : null}

            {catalogStatus === "success" && matches.length > 0 ? (
              <div role="group" aria-label="Historical matches" className="flex flex-col gap-2xs">
                {matches.map((match) => (
                  <button
                    key={match.matchInternalId}
                    type="button"
                    aria-pressed={selectedMatchId === match.matchInternalId}
                    onClick={() => handleSelectMatch(match.matchInternalId)}
                    className="rounded-md border border-surface-border px-sm py-2xs text-left text-sm hover:bg-surface-border data-[state=active]:border-brand-500"
                    data-state={selectedMatchId === match.matchInternalId ? "active" : undefined}
                  >
                    {formatMatchLabel(match.scheduledAt, match.eventFamily, match.teamAProviderId, match.teamBProviderId)}
                  </button>
                ))}
              </div>
            ) : null}

            {predictionStatus === "loading" ? (
              <div className="flex items-center gap-2xs text-sm text-muted-foreground">
                <Spinner size={14} /> Generating historical model prediction…
              </div>
            ) : null}

            {predictionStatus === "error" ? (
              <div className="flex flex-col gap-2xs">
                <p role="alert" className="text-sm text-danger">
                  {predictionError ?? "Unable to generate a prediction for this match."}
                </p>
                {selectedMatchId ? (
                  <Button size="sm" variant="secondary" onClick={() => handleSelectMatch(selectedMatchId)}>
                    Retry
                  </Button>
                ) : null}
              </div>
            ) : null}

            {predictionStatus === "success" && result ? <HistoricalMatchResult result={result} /> : null}
          </>
        ) : null}
      </Stack>
    </Card>
  );
}
