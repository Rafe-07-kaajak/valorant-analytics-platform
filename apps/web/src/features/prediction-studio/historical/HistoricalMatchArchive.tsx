"use client";

import { Calendar, Check } from "lucide-react";
import type { HistoricalMatchSummary } from "@repo/shared";
import { Button, Spinner, cn } from "@repo/ui";

export interface HistoricalMatchArchiveProps {
  status: "idle" | "loading" | "success" | "error";
  matches: readonly HistoricalMatchSummary[];
  error: string | null;
  selectedMatchId: string | null;
  onSelectMatch: (matchInternalId: string) => void;
  onRetry: () => void;
}

function formatScheduledDate(scheduledAt: string): string {
  const date = new Date(scheduledAt);
  return Number.isNaN(date.getTime())
    ? scheduledAt
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * TASK-056 — the historical match list, restyled as an archive ledger.
 * Selecting a row is still the same single action as before (select + run
 * replay in one click, no separate confirm step exists in the underlying
 * logic) -- this only changes how each row looks and what fields of the
 * already-fetched `HistoricalMatchSummary` it surfaces (date, event,
 * region, tier, series format were always in the response, just folded
 * into one string before). Kept as plain `<button>` elements in a scrolling
 * list rather than a custom widget, so Tab/Enter/Space keep working with no
 * extra keyboard handling needed.
 */
export function HistoricalMatchArchive({
  status,
  matches,
  error,
  selectedMatchId,
  onSelectMatch,
  onRetry,
}: HistoricalMatchArchiveProps) {
  if (status === "loading") {
    return (
      <div className="flex items-center gap-2xs text-sm text-muted-foreground">
        <Spinner size={14} /> Loading historical matches...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col gap-2xs">
        <p role="alert" className="text-sm text-danger">
          {error ?? "Unable to load historical matches."}
        </p>
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (status === "success" && matches.length === 0) {
    return <p className="text-sm text-muted-foreground">No historical matches are available for replay yet.</p>;
  }

  if (status !== "success") return null;

  return (
    <div role="group" aria-label="Historical matches" className="flex max-h-80 min-w-0 flex-col gap-2xs overflow-y-auto pr-3xs">
      {matches.map((match) => {
        const selected = selectedMatchId === match.matchInternalId;

        return (
          <button
            key={match.matchInternalId}
            type="button"
            aria-pressed={selected}
            data-state={selected ? "active" : undefined}
            onClick={() => onSelectMatch(match.matchInternalId)}
            className={cn(
              "group flex w-full min-w-0 flex-col gap-1 rounded-md border border-surface-border bg-surface px-sm py-2xs text-left",
              "motion-safe:transition-[border-color,box-shadow] motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard)",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
              "hover:border-(--color-accent-amber)/60",
              selected &&
                "border-(--color-accent-amber) shadow-[0_0_0_1px_var(--color-accent-amber),0_0_14px_-6px_var(--color-accent-amber)]",
            )}
          >
            <div className="flex flex-wrap items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <span>{match.eventFamily}</span>
              <span aria-hidden="true">·</span>
              <span>{match.tournamentLevel}</span>
              <span aria-hidden="true">·</span>
              <span>{match.eventRegion}</span>
              <span aria-hidden="true">·</span>
              <span>{match.seriesFormat}</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2xs gap-y-3xs">
              <span className="flex min-w-0 items-center gap-2xs">
                <Check
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 shrink-0 text-(--color-accent-amber) motion-safe:transition-all motion-safe:duration-(--duration-base)",
                    selected ? "scale-100 opacity-100" : "scale-75 opacity-0",
                  )}
                />
                <span className="break-all font-mono text-sm text-foreground">
                  {match.teamAProviderId} vs {match.teamBProviderId}
                </span>
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Calendar aria-hidden="true" className="size-3" />
                {formatScheduledDate(match.scheduledAt)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
