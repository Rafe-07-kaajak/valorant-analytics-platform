import { useCallback, useMemo, useReducer } from "react";
import type { SimulationResult } from "@repo/shared";
import {
  applyPresetToDraft,
  createEmptyMapDraft,
  createEmptyTeamDraft,
  getSimulationPreset,
  hasAnyAdjustments,
  resetAttributeDelta,
  resetMapDelta,
  setAttributeDelta,
  setMapDelta,
  type AttributeControlKey,
  type MapDraftAdjustment,
  type SimulatorStatus,
  type TeamDraftAdjustment,
} from "../../../lib/whatIfSimulator";

export type SimulatorSide = "A" | "B";

interface SimulatorState {
  teamADraft: TeamDraftAdjustment;
  teamBDraft: TeamDraftAdjustment;
  mapADraft: MapDraftAdjustment;
  mapBDraft: MapDraftAdjustment;
  status: SimulatorStatus;
  simulationResult: SimulationResult | null;
  error: string | null;
  requestCount: number;
}

type SimulatorAction =
  | { type: "set-attribute"; side: SimulatorSide; key: AttributeControlKey; value: number }
  | { type: "reset-attribute"; side: SimulatorSide; key: AttributeControlKey }
  | { type: "set-map"; side: SimulatorSide; mapId: string; value: number }
  | { type: "reset-map"; side: SimulatorSide; mapId: string }
  | { type: "apply-preset"; side: SimulatorSide; presetId: string }
  | { type: "reset-all"; mapIds: readonly string[] }
  | { type: "simulate-start" }
  | { type: "simulate-success"; result: SimulationResult }
  | { type: "simulate-error"; message: string };

function makeInitialState(mapIds: readonly string[]): SimulatorState {
  return {
    teamADraft: createEmptyTeamDraft(),
    teamBDraft: createEmptyTeamDraft(),
    mapADraft: createEmptyMapDraft(mapIds),
    mapBDraft: createEmptyMapDraft(mapIds),
    status: "idle",
    simulationResult: null,
    error: null,
    requestCount: 0,
  };
}

function reducer(state: SimulatorState, action: SimulatorAction): SimulatorState {
  switch (action.type) {
    case "set-attribute": {
      const draftKey = action.side === "A" ? "teamADraft" : "teamBDraft";
      return { ...state, [draftKey]: setAttributeDelta(state[draftKey], action.key, action.value) };
    }
    case "reset-attribute": {
      const draftKey = action.side === "A" ? "teamADraft" : "teamBDraft";
      return { ...state, [draftKey]: resetAttributeDelta(state[draftKey], action.key) };
    }
    case "set-map": {
      const draftKey = action.side === "A" ? "mapADraft" : "mapBDraft";
      return { ...state, [draftKey]: setMapDelta(state[draftKey], action.mapId, action.value) };
    }
    case "reset-map": {
      const draftKey = action.side === "A" ? "mapADraft" : "mapBDraft";
      return { ...state, [draftKey]: resetMapDelta(state[draftKey], action.mapId) };
    }
    case "apply-preset": {
      const preset = getSimulationPreset(action.presetId);
      if (!preset) return state;
      const draftKey = action.side === "A" ? "teamADraft" : "teamBDraft";
      return { ...state, [draftKey]: applyPresetToDraft(state[draftKey], preset) };
    }
    case "reset-all":
      // A full return to baseline (requirement: "resetting all controls
      // must return exactly to the original baseline result") — drafts,
      // any prior simulation result, and the error state all clear.
      // `requestCount` is preserved: it is a lifetime count of actual
      // network requests fired, which Reset All itself never sends.
      return { ...makeInitialState(action.mapIds), requestCount: state.requestCount };
    case "simulate-start":
      return { ...state, status: "loading", error: null };
    case "simulate-success":
      return { ...state, status: "success", simulationResult: action.result, requestCount: state.requestCount + 1 };
    case "simulate-error":
      return { ...state, status: "error", error: action.message, requestCount: state.requestCount + 1 };
    default:
      return state;
  }
}

export interface SimulatorController extends SimulatorState {
  hasAdjustments: boolean;
  setAttribute: (side: SimulatorSide, key: AttributeControlKey, value: number) => void;
  resetAttribute: (side: SimulatorSide, key: AttributeControlKey) => void;
  setMap: (side: SimulatorSide, mapId: string, value: number) => void;
  resetMap: (side: SimulatorSide, mapId: string) => void;
  applyPreset: (side: SimulatorSide, presetId: string) => void;
  resetAll: () => void;
  simulateStart: () => void;
  simulateSuccess: (result: SimulationResult) => void;
  simulateError: (message: string) => void;
}

/**
 * TASK-038 local simulator state — a reducer scoped to one mounted
 * `WhatIfSimulator` instance, never global and never `PredictionResult`
 * state. `mapIds` seeds the per-map draft records; the parent remounts this
 * hook's owner (via a `key` on the baseline scenario) when the underlying
 * Prediction Studio scenario actually changes, which is how "resets when a
 * completely new scenario is generated" is satisfied without any extra
 * synchronization logic here.
 */
export function useSimulatorState(mapIds: readonly string[]): SimulatorController {
  const [state, dispatch] = useReducer(reducer, mapIds, makeInitialState);

  const setAttributeCallback = useCallback(
    (side: SimulatorSide, key: AttributeControlKey, value: number) => dispatch({ type: "set-attribute", side, key, value }),
    [],
  );
  const resetAttributeCallback = useCallback(
    (side: SimulatorSide, key: AttributeControlKey) => dispatch({ type: "reset-attribute", side, key }),
    [],
  );
  const setMapCallback = useCallback(
    (side: SimulatorSide, mapId: string, value: number) => dispatch({ type: "set-map", side, mapId, value }),
    [],
  );
  const resetMapCallback = useCallback(
    (side: SimulatorSide, mapId: string) => dispatch({ type: "reset-map", side, mapId }),
    [],
  );
  const applyPresetCallback = useCallback(
    (side: SimulatorSide, presetId: string) => dispatch({ type: "apply-preset", side, presetId }),
    [],
  );
  const resetAllCallback = useCallback(() => dispatch({ type: "reset-all", mapIds }), [mapIds]);
  const simulateStartCallback = useCallback(() => dispatch({ type: "simulate-start" }), []);
  const simulateSuccessCallback = useCallback((result: SimulationResult) => dispatch({ type: "simulate-success", result }), []);
  const simulateErrorCallback = useCallback((message: string) => dispatch({ type: "simulate-error", message }), []);

  const hasAdjustments = useMemo(
    () => hasAnyAdjustments(state.teamADraft, state.teamBDraft, state.mapADraft, state.mapBDraft),
    [state.teamADraft, state.teamBDraft, state.mapADraft, state.mapBDraft],
  );

  return {
    ...state,
    hasAdjustments,
    setAttribute: setAttributeCallback,
    resetAttribute: resetAttributeCallback,
    setMap: setMapCallback,
    resetMap: resetMapCallback,
    applyPreset: applyPresetCallback,
    resetAll: resetAllCallback,
    simulateStart: simulateStartCallback,
    simulateSuccess: simulateSuccessCallback,
    simulateError: simulateErrorCallback,
  };
}
