import { Check } from "lucide-react";
import { Label, Select, SplitBar, cn } from "@repo/ui";
import { usePointerGlow } from "../../hooks/usePointerGlow";
import { AdvantageBadge } from "../team-comparison/AdvantageBadge";
import { SORT_MODES, type MapRankingRow, type SortMode } from "../../lib/mapMatchup";

export interface MapRankingViewProps {
  teamAName: string;
  teamBName: string;
  rankedRows: MapRankingRow[];
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  activeMapId: string | null;
  onSetActiveMap: (mapId: string) => void;
}

export function MapRankingView({
  teamAName,
  teamBName,
  rankedRows,
  sortMode,
  onSortModeChange,
  activeMapId,
  onSetActiveMap,
}: MapRankingViewProps) {
  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-2xs sm:w-64">
        <Label htmlFor="map-sort-mode">Sort by</Label>
        <Select
          id="map-sort-mode"
          value={sortMode}
          onChange={(event) => onSortModeChange(event.target.value as SortMode)}
        >
          {SORT_MODES.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </Select>
      </div>

      <ul className="flex flex-col gap-sm" aria-label="Maps ranked by modeled gap">
        {rankedRows.map((row) => (
          <MapRankingRowCard
            key={row.mapId}
            row={row}
            teamAName={teamAName}
            teamBName={teamBName}
            isActive={row.mapId === activeMapId}
            onSetActive={() => onSetActiveMap(row.mapId)}
          />
        ))}
      </ul>
    </div>
  );
}

const TIER_WORD: Record<MapRankingRow["tier"], string> = {
  none: "close",
  slight: "slight",
  moderate: "moderate",
  strong: "strong",
};

/**
 * A concise, self-contained accessible name — once a button has an
 * aria-label, screen readers announce only that label rather than its
 * (much noisier) inner content, so this needs to stand in for the map
 * name, advantage, and pool state on its own.
 */
function describeRow(row: MapRankingRow, teamAName: string, teamBName: string): string {
  const advantageText =
    row.advantage === "even"
      ? "close matchup"
      : `${row.advantage === "A" ? teamAName : teamBName} ${TIER_WORD[row.tier]} edge`;
  return `${row.mapName}: ${advantageText}${row.selected ? ", in pool" : ""}`;
}

function MapRankingRowCard({
  row,
  teamAName,
  teamBName,
  isActive,
  onSetActive,
}: {
  row: MapRankingRow;
  teamAName: string;
  teamBName: string;
  isActive: boolean;
  onSetActive: () => void;
}) {
  const glow = usePointerGlow<HTMLButtonElement>();

  return (
    <li>
      <button
        type="button"
        aria-label={describeRow(row, teamAName, teamBName)}
        aria-current={isActive}
        onClick={onSetActive}
        onFocus={onSetActive}
        onPointerEnter={glow.onPointerEnter}
        onPointerMove={glow.onPointerMove}
        onPointerLeave={glow.onPointerLeave}
        className={cn(
          "pointer-glow group relative flex w-full flex-col gap-2xs rounded-md border bg-surface p-sm text-left",
          "motion-safe:transition-[transform,border-color,box-shadow] motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard)",
          "motion-safe:hover:-translate-y-(--lift-card-selectable) motion-safe:active:scale-(--scale-press)",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
          isActive
            ? "border-brand-400 shadow-[0_0_0_1px_var(--color-brand-400),0_0_16px_-6px_var(--color-brand-400)]"
            : "border-surface-border hover:border-brand-400/70 focus-visible:border-brand-400/70",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2xs">
          <span className="flex items-center gap-2xs font-medium text-foreground">
            {row.mapName}
            {row.selected ? (
              // Icon carries the accent color (non-text, only needs 3:1); the
              // label stays neutral text-foreground — text-brand-500 measured
              // 3.11:1 here, below the 4.5:1 text requires. Same pattern as
              // SelectedTeamSummary's colored-dot-plus-neutral-text fix.
              <span className="flex items-center gap-3xs text-xs font-medium text-muted-foreground">
                <Check className="size-3.5 text-brand-500" aria-hidden="true" />
                In pool
              </span>
            ) : null}
          </span>
          <AdvantageBadge advantage={row.advantage} tier={row.tier} teamAName={teamAName} teamBName={teamBName} />
        </div>
        <SplitBar
          segments={[
            { id: "a", label: teamAName, value: row.scoreA, color: "var(--team-a)" },
            { id: "b", label: teamBName, value: row.scoreB, color: "var(--team-b)" },
          ]}
        />
      </button>
    </li>
  );
}
