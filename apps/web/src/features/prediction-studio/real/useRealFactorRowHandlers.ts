import type { KeyboardEvent } from "react";
import type { RealBreakdownController } from "./useRealBreakdownState";

/**
 * Real-model counterpart to the synthetic breakdown's
 * `useDimensionRowHandlers.ts` — identical hover/focus/click/Enter/Space/
 * Escape wiring, generalized to a plain `string` id since real factor ids
 * aren't `DnaDimensionKey`s.
 */
export function realFactorRowHandlers(id: string, breakdown: RealBreakdownController) {
  return {
    onMouseEnter: () => breakdown.hoverFactor(id),
    onMouseLeave: () => breakdown.hoverFactor(null),
    onFocus: () => breakdown.hoverFactor(id),
    onBlur: () => breakdown.hoverFactor(null),
    onClick: () => breakdown.selectFactor(id),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        breakdown.selectFactor(id);
      } else if (event.key === "Escape") {
        breakdown.clear();
      }
    },
  };
}
