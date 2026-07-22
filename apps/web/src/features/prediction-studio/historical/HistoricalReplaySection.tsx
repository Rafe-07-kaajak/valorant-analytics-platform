"use client";

import { useState } from "react";
import { Button, Spinner, Stack } from "@repo/ui";
import { AmbientSectionBackground } from "../../../components/effects/AmbientSectionBackground";
import { useRealPredictionReadiness } from "../../../hooks/useRealPredictionReadiness";
import { useHistoricalCatalog } from "../../../hooks/useHistoricalCatalog";
import { useHistoricalPrediction } from "../../../hooks/useHistoricalPrediction";
import { HistoricalReplayHeader } from "./HistoricalReplayHeader";
import { HistoricalModelSnapshot } from "./HistoricalModelSnapshot";
import { HistoricalMatchArchive } from "./HistoricalMatchArchive";
import { HistoricalMatchResult } from "./HistoricalMatchResult";

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
 *
 * TASK-056 — visual redesign into an "analytical archive console." All
 * state/data flow above is unchanged; only presentation and how the
 * sub-panels are composed changed. Nests its own AmbientSectionBackground
 * (TASK-054's shared component) with a distinct indigo/amber identity
 * (gradients.css) rather than touching Prediction Studio's own page-level
 * ambient wash.
 */
export function HistoricalReplaySection() {
  const { status: readinessStatus, readiness, error: readinessError, refresh: refreshReadiness } = useRealPredictionReadiness();
  const catalogEnabled = readiness?.realPredictionAvailable ?? false;
  const {
    status: catalogStatus,
    matches,
    total: catalogTotal,
    isLoadingMore,
    error: catalogError,
    refresh: refreshCatalog,
    loadMore,
  } = useHistoricalCatalog(catalogEnabled);
  const { status: predictionStatus, result, error: predictionError, requestPrediction } = useHistoricalPrediction();
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  function handleSelectMatch(matchInternalId: string) {
    setSelectedMatchId(matchInternalId);
    void requestPrediction(matchInternalId);
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-surface-border bg-background">
      <AmbientSectionBackground
        wash="var(--gradient-historical-replay-ambient)"
        texture={{ src: "/assets/redesign/textures/blueprint-contours.png", opacity: 0.05 }}
        overlay={{ src: "/assets/redesign/textures/data-streams.png", opacity: 0.08, drift: "slower" }}
      />

      <Stack gap="md" className="relative p-md">
        <HistoricalReplayHeader readinessStatus={readinessStatus} readiness={readiness} />

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
          <div className="flex flex-col gap-md lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start lg:gap-md">
            <div className="flex min-w-0 flex-col gap-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historical archive</span>
              <HistoricalMatchArchive
                status={catalogStatus}
                matches={matches}
                total={catalogTotal}
                isLoadingMore={isLoadingMore}
                error={catalogError}
                selectedMatchId={selectedMatchId}
                onSelectMatch={handleSelectMatch}
                onRetry={() => void refreshCatalog()}
                onLoadMore={() => void loadMore()}
              />
            </div>

            <HistoricalModelSnapshot readiness={readiness} />
          </div>
        ) : null}

        {predictionStatus === "loading" ? (
          <div className="flex items-center gap-2xs text-sm text-muted-foreground">
            <Spinner size={14} /> Evaluating archived model…
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
      </Stack>
    </div>
  );
}
