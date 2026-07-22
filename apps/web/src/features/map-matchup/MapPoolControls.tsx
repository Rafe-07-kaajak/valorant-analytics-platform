import { useRef } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import Image from "next/image";
import type { GameMap } from "@repo/shared";
import { Check } from "lucide-react";
import { Button, cn } from "@repo/ui";
import { getMapArtworkPath } from "../prediction-studio/mapArtwork";

export interface MapPoolControlsProps {
  maps: GameMap[];
  selectedMapIds: string[];
  /** Precomputed by the caller via `selectCloseMaps` — kept out of this presentational component. */
  closeMapCount: number;
  onToggle: (mapId: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onSelectClose: () => void;
}

const ARROW_KEYS = new Set(["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"]);

/**
 * TASK-058 — real map artwork replaces the plain text toggle buttons this
 * component previously rendered, following the tile pattern Prediction
 * Studio's `MapSelector` established (TASK-055): full-bleed artwork,
 * readability scrim, dark translucent nameplate. Unlike `MapSelector`, this
 * pool is unrestricted (no `maxSelectable` cap, no disabled tiles at a
 * limit) per TASK-036's inclusion-filter semantics, so that logic is
 * deliberately not carried over. Each tile stays a plain `<button>` whose
 * only text node is the map name, so its accessible name is unchanged
 * (existing tests query tiles by `getByRole("button", { name: "Ascent" })`).
 */
export function MapPoolControls({
  maps,
  selectedMapIds,
  closeMapCount,
  onToggle,
  onSelectAll,
  onClear,
  onSelectClose,
}: MapPoolControlsProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!ARROW_KEYS.has(event.key)) return;
    event.preventDefault();
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const nextIndex = (index + (forward ? 1 : -1) + maps.length) % maps.length;
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <span className="text-sm font-medium text-foreground" id="map-pool-label">
          Map Pool ({selectedMapIds.length}/{maps.length})
        </span>
        <div className="flex flex-wrap gap-2xs">
          <Button type="button" variant="secondary" size="sm" onClick={onSelectAll}>
            Select All
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onClear} disabled={selectedMapIds.length === 0}>
            Clear
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onSelectClose} disabled={closeMapCount === 0}>
            Close Maps
          </Button>
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-2xs sm:grid-cols-4 md:grid-cols-6"
        role="group"
        aria-labelledby="map-pool-label"
      >
        {maps.map((map, index) => {
          const selected = selectedMapIds.includes(map.id);
          const artworkPath = getMapArtworkPath(map.id);

          return (
            <button
              key={map.id}
              ref={(node) => {
                buttonRefs.current[index] = node;
              }}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(map.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              style={{ "--map-tile-accent": "var(--color-accent-cyan)" } as CSSProperties}
              className={cn(
                "group relative aspect-video w-full overflow-hidden rounded-md border border-surface-border bg-surface",
                "motion-safe:transition-[transform,border-color,box-shadow] motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard)",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                "motion-safe:hover:-translate-y-(--lift-card-selectable) motion-safe:active:scale-(--scale-press) hover:border-(--map-tile-accent)/70",
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
                  sizes="(min-width: 768px) 16vw, (min-width: 640px) 25vw, 50vw"
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
                <Check className="size-3.5 text-(--map-tile-accent)" />
              </span>

              <span className="absolute bottom-1.5 left-1.5 z-10 max-w-[calc(100%-0.75rem)] truncate rounded-md border border-white/10 bg-surface/80 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                {map.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
