import { cn } from "@repo/ui";
import type { CurrentPredictionResponse } from "@repo/shared";
import { realFactorRowHandlers } from "./useRealFactorRowHandlers";
import type { RealBreakdownController } from "./useRealBreakdownState";

export interface RealKeyFactorsTabProps {
  result: CurrentPredictionResponse;
  teamAName: string;
  teamBName: string;
  breakdown: RealBreakdownController;
}

function FactorRow({
  id,
  label,
  description,
  favoredName,
  breakdown,
  emphasize,
}: {
  id: string;
  label: string;
  description: string;
  favoredName: string | null;
  breakdown: RealBreakdownController;
  emphasize: boolean;
}) {
  const isSelected = breakdown.selectedFactorId === id;
  const isActive = breakdown.activeFactorId === id;

  return (
    <li>
      <button
        type="button"
        aria-current={isSelected}
        {...realFactorRowHandlers(id, breakdown)}
        aria-label={favoredName ? `${label}: favors ${favoredName}. ${description}` : `${label}: ${description}`}
        className={cn(
          "flex w-full flex-col gap-2xs rounded-md border bg-surface p-sm text-left",
          "motion-safe:transition-[transform,border-color,box-shadow] motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard)",
          "motion-safe:hover:-translate-y-(--lift-card-selectable)",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
          isSelected
            ? "border-brand-400 shadow-[0_0_0_1px_var(--color-brand-400),0_0_16px_-6px_var(--color-brand-400)]"
            : isActive
              ? "border-brand-400/70"
              : "border-surface-border",
          !isActive && !isSelected && breakdown.activeFactorId ? "opacity-70" : "opacity-100",
          emphasize ? "ring-1 ring-brand-400/40" : "",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2xs">
          <span className="font-medium text-foreground">{label}</span>
          {favoredName ? <span className="text-sm text-muted-foreground">Favors {favoredName}</span> : <span className="text-sm text-muted-foreground">Balanced</span>}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </button>
    </li>
  );
}

/**
 * Tab 3 of the Real Prediction Breakdown. Deliberately two visually distinct
 * groups (never merged into one flat list), per the task brief's "Actual
 * Model Contribution vs. Supporting Real Context" split: the estimator's one
 * real driver first, then every other real differential explicitly labeled
 * as non-driving context.
 */
export function RealKeyFactorsTab({ result, teamAName, teamBName, breakdown }: RealKeyFactorsTabProps) {
  const { contribution, supportingContext } = result;
  const favorsTeamA = contribution.driverDifferential >= 0;
  const driverFavoredName = favorsTeamA ? teamAName : teamBName;

  const factorFavoredName = (favoredSide: "teamA" | "teamB" | "even") =>
    favoredSide === "even" ? null : favoredSide === "teamA" ? teamAName : teamBName;

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-col gap-sm">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Actual Model Driver</h4>
        <ul className="flex flex-col gap-sm">
          <FactorRow
            id="model-driver"
            label={contribution.driverLabel}
            description={`This is the only real signal the currently selected ${result.estimatorType} estimator consumes.`}
            favoredName={driverFavoredName}
            breakdown={breakdown}
            emphasize
          />
        </ul>
      </div>

      <div className="flex flex-col gap-sm">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Supporting Real Context</h4>
        <p className="text-xs text-muted-foreground">
          Real differentials the current estimator does not consume. Shown for context, never implied to have
          changed this prediction.
        </p>
        <ul className="flex flex-col gap-sm">
          {supportingContext.map((factor) => (
            <FactorRow
              key={factor.id}
              id={factor.id}
              label={factor.label}
              description={factor.description}
              favoredName={factorFavoredName(factor.favoredSide)}
              breakdown={breakdown}
              emphasize={false}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
