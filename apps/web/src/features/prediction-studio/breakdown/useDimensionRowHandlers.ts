import type { KeyboardEvent } from "react";
import type { DnaDimensionKey } from "@repo/shared";
import type { BreakdownController } from "./useBreakdownState";

/**
 * The same five-handler wiring (hover shows a temporary preview, click/Enter/
 * Space persists a selection, Escape clears) is reused identically by every
 * dimension-keyed row across the Contributions, Match DNA, and Key Factors
 * tabs — factored out once rather than repeated three times. Cheap to
 * recreate per render (a handful of small closures over at most nine rows),
 * so this is a plain function rather than a memoized hook.
 */
export function dimensionRowHandlers(key: DnaDimensionKey, breakdown: BreakdownController) {
  return {
    onMouseEnter: () => breakdown.hoverDimension(key),
    onMouseLeave: () => breakdown.hoverDimension(null),
    onFocus: () => breakdown.hoverDimension(key),
    onBlur: () => breakdown.hoverDimension(null),
    onClick: () => breakdown.selectDimension(key),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        breakdown.selectDimension(key);
      } else if (event.key === "Escape") {
        breakdown.clear();
      }
    },
  };
}
