"use client";

import { useCallback, useState } from "react";
import type { CurrentPredictionResponse, PredictionResult, Scenario, TournamentTier } from "@repo/shared";
import { predictCurrentMatch } from "../lib/api/realPrediction";
import { mapRealResponseToPredictionResult } from "../lib/realModel2/presentationAdapter";

type Status = "idle" | "loading" | "success" | "error";

export interface RealModel2Request {
  scenario: Scenario;
  teamAName: string;
  teamBName: string;
  tournamentTier: TournamentTier;
  eventRegion?: string;
}

/**
 * Prediction Studio mode-correction task — Real Model 2.0's prediction hook.
 * Calls the exact same real backend endpoint Real Model 1.0 uses
 * (`predictCurrentMatch` -> `/api/internal/prediction/current`, the real
 * ingested-data pipeline), never the synthetic `/api/vct-prediction` route,
 * never `generateVctPrediction`. The raw `CurrentPredictionResponse` is kept
 * alongside the mapped `PredictionResult` so the What-if Simulator's real
 * baseline/recompute (which need real team-state numbers, not just the
 * display-mapped result) can read it directly.
 */
export function useRealModel2Prediction() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [rawResponse, setRawResponse] = useState<CurrentPredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestPrediction = useCallback(async (request: RealModel2Request) => {
    setStatus("loading");
    setError(null);
    setResult(null);
    setRawResponse(null);

    try {
      const response = await predictCurrentMatch({
        teamAId: request.scenario.teamAId,
        teamBId: request.scenario.teamBId,
        seriesFormat: request.scenario.seriesFormat,
        tournamentTier: request.tournamentTier,
        eventRegion: request.eventRegion,
        requestId: crypto.randomUUID(),
      });
      const mapped = mapRealResponseToPredictionResult(response, request.teamAName, request.teamBName, request.scenario.mapIds);
      setRawResponse(response);
      setResult(mapped);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setRawResponse(null);
    setError(null);
  }, []);

  return { status, result, rawResponse, error, requestPrediction, reset };
}
