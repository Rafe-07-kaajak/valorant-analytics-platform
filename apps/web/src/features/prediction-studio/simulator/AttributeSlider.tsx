"use client";

import { RotateCcw } from "lucide-react";
import { Slider, cn } from "@repo/ui";

export interface AttributeSliderProps {
  id: string;
  accent: "team-a" | "team-b";
  teamName: string;
  label: string;
  baseline: number;
  delta: number;
  ariaLabel: string;
  onChange: (value: number) => void;
  onReset: () => void;
}

/**
 * One draft-only control: moving the slider never sends a request — it only
 * updates local draft state (`onChange`), which the parent later converts
 * into a `VctProfileAdjustment` when "Run Simulation" is pressed. The reset
 * button's accessible name includes `teamName` — Team A and Team B each have
 * their own same-labeled attribute (e.g. both have "Aggression"), so without
 * it two reset buttons on the page would share an identical, ambiguous name.
 */
export function AttributeSlider({ id, accent, teamName, label, baseline, delta, ariaLabel, onChange, onReset }: AttributeSliderProps) {
  const simulated = Math.min(100, Math.max(0, Math.round(baseline + delta)));
  const deltaText = delta === 0 ? "±0" : delta > 0 ? `+${delta}` : `${delta}`;

  return (
    <div className="flex flex-col gap-3xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2xs">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <span className="text-xs text-muted-foreground">
          Baseline {baseline} · <span className={cn(delta !== 0 && "font-semibold text-foreground")}>{deltaText}</span> · Simulated{" "}
          {simulated}
        </span>
      </div>
      <div className="flex items-center gap-2xs">
        <Slider
          id={id}
          min={-15}
          max={15}
          step={1}
          value={delta}
          aria-label={ariaLabel}
          onChange={(event) => onChange(Number(event.target.value))}
          className={accent === "team-a" ? "accent-team-a" : "accent-team-b"}
        />
        <button
          type="button"
          onClick={onReset}
          disabled={delta === 0}
          aria-label={`Reset ${teamName} ${label} to baseline`}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-muted-foreground",
            "transition-colors duration-(--duration-fast) ease-(--ease-standard)",
            "hover:text-foreground disabled:pointer-events-none disabled:opacity-30",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
          )}
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
