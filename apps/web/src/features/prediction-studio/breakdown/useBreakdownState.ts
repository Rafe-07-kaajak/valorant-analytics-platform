import { useCallback, useReducer } from "react";
import type { DnaDimensionKey } from "@repo/shared";

/**
 * TASK-037 cross-highlighting state for the Interactive Prediction
 * Breakdown. A single small reducer, not `PredictionResult` state and not
 * global — scoped entirely to one mounted breakdown instance.
 *
 * `activeContributionId`, `activeDnaDimensionKey`, and `activeFactorId` from
 * the task's own example are unified into one `selectedDimension` /
 * `hoveredDimension` pair here: a `KeyFactor.id` *is* a `DnaDimensionKey`
 * string (the engine generates key factors directly from Team DNA
 * dimensions — see `factorLinks.ts`), so a contribution row, a key factor,
 * and a Team DNA dimension identified by the same key are the same entity
 * across the three tabs that key off it. Three separately-tracked fields
 * that must always mirror each other would only add a way for them to drift
 * out of sync; one field is both simpler and provably correct.
 * `activePipelineStageId` is genuinely independent (a different id
 * namespace, no shared identity with DNA dimensions) and stays separate.
 *
 * Hover is a temporary overlay on top of a persisted selection: leaving a
 * row with the mouse clears only the hover, never the keyboard/click
 * selection underneath it (`hover: null` action) — the active id exposed to
 * consumers is `hoveredDimension ?? selectedDimension`, so hover shows
 * immediately but selection survives after the pointer leaves.
 */
export interface BreakdownState {
  selectedDimension: DnaDimensionKey | null;
  hoveredDimension: DnaDimensionKey | null;
  selectedStage: string | null;
  hoveredStage: string | null;
}

type BreakdownAction =
  | { type: "select-dimension"; key: DnaDimensionKey }
  | { type: "hover-dimension"; key: DnaDimensionKey | null }
  | { type: "select-stage"; id: string }
  | { type: "hover-stage"; id: string | null }
  | { type: "clear" };

const INITIAL_STATE: BreakdownState = {
  selectedDimension: null,
  hoveredDimension: null,
  selectedStage: null,
  hoveredStage: null,
};

function reducer(state: BreakdownState, action: BreakdownAction): BreakdownState {
  switch (action.type) {
    case "select-dimension":
      return { ...state, selectedDimension: action.key };
    case "hover-dimension":
      return { ...state, hoveredDimension: action.key };
    case "select-stage":
      return { ...state, selectedStage: action.id };
    case "hover-stage":
      return { ...state, hoveredStage: action.id };
    case "clear":
      return INITIAL_STATE;
    default:
      return state;
  }
}

export interface BreakdownController {
  /** The dimension key to visually treat as "active" right now — hover takes temporary precedence over a persisted selection. */
  activeDimensionKey: DnaDimensionKey | null;
  selectedDimensionKey: DnaDimensionKey | null;
  activeStageId: string | null;
  selectedStageId: string | null;
  selectDimension: (key: DnaDimensionKey) => void;
  hoverDimension: (key: DnaDimensionKey | null) => void;
  selectStage: (id: string) => void;
  hoverStage: (id: string | null) => void;
  clear: () => void;
}

export function useBreakdownState(): BreakdownController {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const selectDimension = useCallback((key: DnaDimensionKey) => dispatch({ type: "select-dimension", key }), []);
  const hoverDimension = useCallback((key: DnaDimensionKey | null) => dispatch({ type: "hover-dimension", key }), []);
  const selectStage = useCallback((id: string) => dispatch({ type: "select-stage", id }), []);
  const hoverStage = useCallback((id: string | null) => dispatch({ type: "hover-stage", id }), []);
  const clear = useCallback(() => dispatch({ type: "clear" }), []);

  return {
    activeDimensionKey: state.hoveredDimension ?? state.selectedDimension,
    selectedDimensionKey: state.selectedDimension,
    activeStageId: state.hoveredStage ?? state.selectedStage,
    selectedStageId: state.selectedStage,
    selectDimension,
    hoverDimension,
    selectStage,
    hoverStage,
    clear,
  };
}
