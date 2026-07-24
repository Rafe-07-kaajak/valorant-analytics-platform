"use client";

import { cn } from "@repo/ui";
import type { ScenarioMode } from "../../lib/urlState";

export interface PredictionModeToggleProps {
  mode: ScenarioMode;
  onModeChange: (mode: ScenarioMode) => void;
}

/**
 * Prediction Studio mode-correction task — both modes are now real-data-
 * backed; only the presentation layer differs. Internal wire values
 * (`ScenarioMode`: "synthetic" | "real") are deliberately unchanged from
 * before this rename, so existing URLs/bookmarks (`?mode=synthetic`,
 * `?mode=real`) keep working with no compatibility mapping needed — only
 * the visible labels changed. "synthetic" now means "Real Model 2.0" (the
 * former Synthetic Scenario UI, now backed by the real pipeline); "real"
 * means "Real Model 1.0" (unchanged from before this task).
 */
const MODE_OPTIONS: { value: ScenarioMode; label: string }[] = [
  { value: "synthetic", label: "Real Model 2.0" },
  { value: "real", label: "Real Model 1.0" },
];

/**
 * Real-model integration task: an explicit, always-visible choice between
 * two real-data-backed presentations of Prediction Studio — never a silent
 * fallback between the two in either direction. Segmented control, matching
 * `MatchContextCore`'s existing series-format control exactly.
 */
export function PredictionModeToggle({ mode, onModeChange }: PredictionModeToggleProps) {
  return (
    <div className="flex flex-col items-center gap-2xs">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" id="prediction-mode-label">
        Prediction Mode
      </span>
      <div role="group" aria-labelledby="prediction-mode-label" className="inline-flex rounded-md border border-surface-border bg-surface p-[3px]">
        {MODE_OPTIONS.map((option) => {
          const active = option.value === mode;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onModeChange(option.value)}
              className={cn(
                "rounded-sm px-3 py-1.5 text-sm font-medium motion-safe:transition-colors motion-safe:duration-(--duration-fast) motion-safe:ease-(--ease-standard)",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                active ? "bg-brand-500 text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
