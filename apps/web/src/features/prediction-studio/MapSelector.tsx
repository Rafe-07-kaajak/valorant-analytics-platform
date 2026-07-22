import { useRef } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { GameMap } from "@repo/shared";
import { Check } from "lucide-react";
import { cn } from "@repo/ui";

export interface MapSelectorProps {
  maps: GameMap[];
  selectedMapIds: string[];
  maxSelectable: number;
  onToggle: (mapId: string) => void;
}

const ARROW_KEYS = new Set(["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"]);

/**
 * TASK-055 — tactical map chips replacing the previous flat text buttons.
 * No per-map thumbnail asset exists anywhere in the redesign asset library
 * (`GameMap` is just `{id, name}` — reported in the pre-edit inspection
 * rather than generating a new photographic thumbnail); each chip instead
 * gets an accent-tinted tile carrying the map's initial, cycling through
 * the same accent palette ProductStory's pipeline uses, so chips stay
 * visually distinct without inventing map artwork.
 */
const CHIP_ACCENTS = [
  "var(--color-accent-cyan)",
  "var(--color-accent-blue)",
  "var(--color-accent-violet)",
  "var(--color-accent-magenta)",
] as const;

export function MapSelector({ maps, selectedMapIds, maxSelectable, onToggle }: MapSelectorProps) {
  const limitReached = selectedMapIds.length >= maxSelectable;
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!ARROW_KEYS.has(event.key)) return;
    event.preventDefault();

    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const step = forward ? 1 : -1;

    for (let offset = 1; offset <= maps.length; offset += 1) {
      const nextIndex = (index + step * offset + maps.length) % maps.length;
      const nextMap = maps[nextIndex];
      const nextDisabled = !selectedMapIds.includes(nextMap.id) && limitReached;
      if (!nextDisabled) {
        buttonRefs.current[nextIndex]?.focus();
        return;
      }
    }
  }

  return (
    <div className="flex flex-col gap-2xs">
      <span className="text-sm font-medium text-foreground" id="map-pool-label">
        Map Pool ({selectedMapIds.length}/{maxSelectable})
      </span>
      <div
        className="grid grid-cols-2 gap-2xs sm:grid-cols-4"
        role="group"
        aria-labelledby="map-pool-label"
      >
        {maps.map((map, index) => {
          const selected = selectedMapIds.includes(map.id);
          const disabled = !selected && limitReached;
          const accent = CHIP_ACCENTS[index % CHIP_ACCENTS.length];

          return (
            <button
              key={map.id}
              ref={(node) => {
                buttonRefs.current[index] = node;
              }}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onToggle(map.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              style={{ "--map-chip-accent": accent } as CSSProperties}
              className={cn(
                "group relative flex flex-col items-center gap-2xs rounded-md border border-surface-border bg-surface px-2 py-2.5 text-center",
                "motion-safe:transition-[transform,border-color,box-shadow] motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard)",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                disabled
                  ? "cursor-not-allowed opacity-40"
                  : "motion-safe:hover:-translate-y-(--lift-card-selectable) motion-safe:active:scale-(--scale-press) hover:border-(--map-chip-accent)/70",
                selected &&
                  "border-(--map-chip-accent) shadow-[0_0_0_1px_var(--map-chip-accent),0_0_14px_-6px_var(--map-chip-accent)]",
              )}
            >
              <Check
                aria-hidden="true"
                className={cn(
                  "absolute right-1 top-1 size-3.5 motion-safe:transition-all motion-safe:duration-(--duration-base)",
                  selected ? "scale-100 opacity-100" : "scale-75 opacity-0",
                )}
                style={{ color: accent }}
              />
              <span
                aria-hidden="true"
                className="flex size-9 items-center justify-center rounded-md text-sm font-semibold uppercase text-white"
                style={{ background: `color-mix(in oklab, ${accent} 55%, var(--surface-raised))` }}
              >
                {map.name.slice(0, 1)}
              </span>
              <span className="text-xs font-medium text-foreground">{map.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
