import { Fragment } from "react";
import type { DnaDimensionKey } from "@repo/shared";
import { Card, cn } from "@repo/ui";
import type { ExplanationFragment } from "../../lib/predictionBreakdown";

export interface ExplanationCardProps {
  explanation: string;
  /**
   * TASK-037 optional highlight layer. Omitted (the default), this component
   * renders byte-identical to its pre-TASK-037 output — a single plain
   * paragraph. Provided, each sentence renders as its own span, and
   * sentences that `explanationLinks.ts` deterministically tied to a Team
   * DNA dimension become keyboard-reachable and react to the shared
   * breakdown state. The visible text is unchanged either way.
   */
  fragments?: ExplanationFragment[];
  activeDimensionKey?: DnaDimensionKey | null;
  selectedDimensionKey?: DnaDimensionKey | null;
  onHoverDimension?: (key: DnaDimensionKey | null) => void;
  onSelectDimension?: (key: DnaDimensionKey) => void;
}

export function ExplanationCard({
  explanation,
  fragments,
  activeDimensionKey = null,
  selectedDimensionKey = null,
  onHoverDimension,
  onSelectDimension,
}: ExplanationCardProps) {
  return (
    <Card className="flex flex-col gap-2xs">
      <h3>Why This Prediction</h3>
      {fragments ? (
        <p className="text-muted-foreground">
          {fragments.map((fragment, index) => (
            <Fragment key={`${fragment.linkedDimensionKey ?? "plain"}-${index}`}>
              {index > 0 ? " " : null}
              {fragment.linkedDimensionKey ? (
                <button
                  type="button"
                  aria-pressed={selectedDimensionKey === fragment.linkedDimensionKey}
                  onMouseEnter={() => onHoverDimension?.(fragment.linkedDimensionKey)}
                  onMouseLeave={() => onHoverDimension?.(null)}
                  onFocus={() => onHoverDimension?.(fragment.linkedDimensionKey)}
                  onBlur={() => onHoverDimension?.(null)}
                  onClick={() => fragment.linkedDimensionKey && onSelectDimension?.(fragment.linkedDimensionKey)}
                  className={cn(
                    "rounded-xs underline decoration-dotted underline-offset-2",
                    "motion-safe:transition-colors motion-safe:duration-(--duration-fast) motion-safe:ease-(--ease-standard)",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                    activeDimensionKey === fragment.linkedDimensionKey
                      ? "bg-brand-400/10 text-foreground decoration-solid"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {fragment.text}
                </button>
              ) : (
                <span>{fragment.text}</span>
              )}
            </Fragment>
          ))}
        </p>
      ) : (
        <p className="text-muted-foreground">{explanation}</p>
      )}
    </Card>
  );
}
