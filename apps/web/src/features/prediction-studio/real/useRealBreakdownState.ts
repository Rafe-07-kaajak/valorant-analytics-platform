import { useCallback, useReducer } from "react";

/**
 * Real-model counterpart to the synthetic breakdown's `useBreakdownState.ts`
 * — same reducer shape (persisted selection + temporary hover overlay,
 * cross-highlighting a factor across tabs), but keyed on plain `string` ids
 * instead of `DnaDimensionKey`, since real factor ids
 * (`RealContextFactorId` plus `"model-driver"`) are a different, real-data
 * vocabulary with no shared identity with the synthetic Team DNA keys.
 */
export interface RealBreakdownState {
  selectedFactor: string | null;
  hoveredFactor: string | null;
  selectedStage: string | null;
  hoveredStage: string | null;
}

type RealBreakdownAction =
  | { type: "select-factor"; id: string }
  | { type: "hover-factor"; id: string | null }
  | { type: "select-stage"; id: string }
  | { type: "hover-stage"; id: string | null }
  | { type: "clear" };

const INITIAL_STATE: RealBreakdownState = {
  selectedFactor: null,
  hoveredFactor: null,
  selectedStage: null,
  hoveredStage: null,
};

function reducer(state: RealBreakdownState, action: RealBreakdownAction): RealBreakdownState {
  switch (action.type) {
    case "select-factor":
      return { ...state, selectedFactor: action.id };
    case "hover-factor":
      return { ...state, hoveredFactor: action.id };
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

export interface RealBreakdownController {
  activeFactorId: string | null;
  selectedFactorId: string | null;
  activeStageId: string | null;
  selectedStageId: string | null;
  selectFactor: (id: string) => void;
  hoverFactor: (id: string | null) => void;
  selectStage: (id: string) => void;
  hoverStage: (id: string | null) => void;
  clear: () => void;
}

export function useRealBreakdownState(): RealBreakdownController {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const selectFactor = useCallback((id: string) => dispatch({ type: "select-factor", id }), []);
  const hoverFactor = useCallback((id: string | null) => dispatch({ type: "hover-factor", id }), []);
  const selectStage = useCallback((id: string) => dispatch({ type: "select-stage", id }), []);
  const hoverStage = useCallback((id: string | null) => dispatch({ type: "hover-stage", id }), []);
  const clear = useCallback(() => dispatch({ type: "clear" }), []);

  return {
    activeFactorId: state.hoveredFactor ?? state.selectedFactor,
    selectedFactorId: state.selectedFactor,
    activeStageId: state.hoveredStage ?? state.selectedStage,
    selectedStageId: state.selectedStage,
    selectFactor,
    hoverFactor,
    selectStage,
    hoverStage,
    clear,
  };
}
