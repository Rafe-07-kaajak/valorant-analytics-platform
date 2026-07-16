import { useRef } from "react";
import type { KeyboardEvent } from "react";
import type { GameMap } from "@repo/shared";
import { Button, cn } from "@repo/ui";

export interface MapSelectorProps {
  maps: GameMap[];
  selectedMapIds: string[];
  maxSelectable: number;
  onToggle: (mapId: string) => void;
}

const ARROW_KEYS = new Set(["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"]);

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
      <div className="flex flex-wrap gap-2xs" role="group" aria-labelledby="map-pool-label">
        {maps.map((map, index) => {
          const selected = selectedMapIds.includes(map.id);
          const disabled = !selected && limitReached;

          return (
            <Button
              key={map.id}
              ref={(node) => {
                buttonRefs.current[index] = node;
              }}
              type="button"
              variant={selected ? "primary" : "secondary"}
              size="sm"
              disabled={disabled}
              aria-pressed={selected}
              className={cn(disabled && "opacity-40")}
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
