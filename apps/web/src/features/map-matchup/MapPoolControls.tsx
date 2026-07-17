import { useRef } from "react";
import type { KeyboardEvent } from "react";
import type { GameMap } from "@repo/shared";
import { Button } from "@repo/ui";

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
 * Unrestricted map-pool multi-select — zero or more maps may be selected,
 * unlike Prediction Studio's `MapSelector` (which caps at the series
 * format's map count). Same aria-pressed toggle-button pattern and
 * arrow-key convenience navigation, deliberately kept consistent with that
 * existing control rather than introducing a second pattern.
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

      <div className="flex flex-wrap gap-2xs" role="group" aria-labelledby="map-pool-label">
        {maps.map((map, index) => {
          const selected = selectedMapIds.includes(map.id);
          return (
            <Button
              key={map.id}
              ref={(node) => {
                buttonRefs.current[index] = node;
              }}
              type="button"
              variant={selected ? "primary" : "secondary"}
              size="sm"
              aria-pressed={selected}
              onClick={() => onToggle(map.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {map.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
