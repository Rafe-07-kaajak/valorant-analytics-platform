import { useRef } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import Image from "next/image";
import type { GameMap } from "@repo/shared";
import { Check } from "lucide-react";
import { cn } from "@repo/ui";
import { getMapArtworkPath } from "./mapArtwork";

export interface MapSelectorProps {
  maps: GameMap[];
  selectedMapIds: string[];
  maxSelectable: number;
  onToggle: (mapId: string) => void;
}

const ARROW_KEYS = new Set(["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"]);

/**
 * TASK-055 — each map tile now uses its real artwork (`./mapArtwork`) as a
 * full-bleed background instead of the earlier single-letter accent chip
 * (no thumbnail asset existed when that version shipped). A dark gradient
 * keeps the rectangular name nameplate readable over any source photo, and
 * the accent cycling that used to color the letter tile now colors the
 * selected/hover border and check badge instead, so tiles stay visually
 * distinct without a giant letter.
 */
const TILE_ACCENTS = [
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
          const accent = TILE_ACCENTS[index % TILE_ACCENTS.length];
          const artworkPath = getMapArtworkPath(map.id);

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
              style={{ "--map-tile-accent": accent } as CSSProperties}
              className={cn(
                "group relative aspect-video w-full overflow-hidden rounded-md border border-surface-border bg-surface",
                "motion-safe:transition-[transform,border-color,box-shadow] motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard)",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                disabled
                  ? "cursor-not-allowed opacity-40"
                  : "motion-safe:hover:-translate-y-(--lift-card-selectable) motion-safe:active:scale-(--scale-press) hover:border-(--map-tile-accent)/70",
                selected &&
                  "border-(--map-tile-accent) shadow-[0_0_0_1px_var(--map-tile-accent),0_0_14px_-6px_var(--map-tile-accent)]",
              )}
            >
              {artworkPath ? (
                <Image
                  src={artworkPath}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="(min-width: 640px) 25vw, 50vw"
                  className="object-cover motion-safe:transition-transform motion-safe:duration-(--duration-base) motion-safe:group-hover:scale-105"
                />
              ) : null}

              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/5"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5"
                aria-hidden="true"
              />

              <span
                aria-hidden="true"
                className={cn(
                  "absolute right-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-full border border-white/10 bg-surface/80 backdrop-blur-sm motion-safe:transition-all motion-safe:duration-(--duration-base)",
                  selected ? "scale-100 opacity-100" : "scale-75 opacity-0",
                )}
              >
                <Check className="size-3.5" style={{ color: accent }} />
              </span>

              <span
                className="absolute bottom-1.5 left-1.5 z-10 max-w-[calc(100%-0.75rem)] truncate rounded-md border border-white/10 bg-surface/80 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm"
              >
                {map.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
