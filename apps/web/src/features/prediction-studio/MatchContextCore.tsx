"use client";

import type { SeriesFormat } from "@repo/shared";
import { cn } from "@repo/ui";

export interface MatchContextCoreProps {
  seriesFormat: SeriesFormat;
  onSeriesFormatChange: (format: SeriesFormat) => void;
  selectedMapNames: string[];
  maxSelectable: number;
  teamAReady: boolean;
  teamBReady: boolean;
}

const SERIES_FORMAT_OPTIONS: { value: SeriesFormat; label: string; shortLabel: string }[] = [
  { value: "BO3", label: "Best of 3", shortLabel: "BO3" },
  { value: "BO5", label: "Best of 5", shortLabel: "BO5" },
];

/**
 * TASK-055 — the central "match context" core between the two team panels.
 * Replaces the old bare "VS" div: a neutral VS node that brightens as each
 * side is filled in, the series-format segmented control (a real
 * `role="group"` button pair, not a native `<select>` — a segmented control
 * cannot represent a set of always-visible options as a single dropdown
 * element), and a compact read-only summary of the map pool. The full,
 * interactive map-chip grid stays its own full-width section below the
 * three-column console (a real 8-map grid does not fit a ~220-450px
 * column) — this only ever *reflects* that selection.
 */
export function MatchContextCore({
  seriesFormat,
  onSeriesFormatChange,
  selectedMapNames,
  maxSelectable,
  teamAReady,
  teamBReady,
}: MatchContextCoreProps) {
  const readyCount = Number(teamAReady) + Number(teamBReady);

  return (
    <div className="flex flex-col items-center gap-md lg:h-full lg:justify-center">
      <div className="relative flex size-16 items-center justify-center rounded-full" aria-hidden="true">
        <span
          className={cn(
            "absolute inset-0 rounded-full motion-safe:transition-opacity motion-safe:duration-(--duration-panel)",
            readyCount === 0 && "opacity-30",
            readyCount === 1 && "opacity-60",
            readyCount === 2 && "opacity-100",
          )}
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--team-a) 35%, transparent) 0%, color-mix(in oklab, var(--color-accent-violet) 30%, transparent) 55%, transparent 75%)",
          }}
        />
        <span
          className={cn(
            "relative flex size-12 items-center justify-center rounded-full border text-sm font-semibold uppercase tracking-wide",
            "motion-safe:transition-[border-color,box-shadow] motion-safe:duration-(--duration-panel)",
            readyCount === 2
              ? "border-brand-400 text-foreground shadow-[0_0_20px_-4px_var(--color-brand-400)]"
              : "border-surface-border text-muted-foreground",
          )}
        >
          VS
        </span>
      </div>

      <div className="flex flex-col items-center gap-2xs">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" id="series-format-label">
          Series Format
        </span>
        <div
          role="group"
          aria-labelledby="series-format-label"
          className="inline-flex rounded-md border border-surface-border bg-surface p-[3px]"
        >
          {SERIES_FORMAT_OPTIONS.map((option) => {
            const active = option.value === seriesFormat;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => onSeriesFormatChange(option.value)}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-sm font-medium motion-safe:transition-colors motion-safe:duration-(--duration-fast) motion-safe:ease-(--ease-standard)",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                  active
                    ? "bg-brand-500 text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2xs text-center">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Map Pool {selectedMapNames.length}/{maxSelectable}
        </span>
        {selectedMapNames.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-1">
            {selectedMapNames.map((name) => (
              <span
                key={name}
                className="rounded-sm border border-surface-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
              >
                {name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Select maps below</span>
        )}
      </div>
    </div>
  );
}
