import type { GameMap } from "@repo/shared";
import { Button, cn } from "@repo/ui";

export interface MapSelectorProps {
  maps: GameMap[];
  selectedMapIds: string[];
  maxSelectable: number;
  onToggle: (mapId: string) => void;
}

export function MapSelector({ maps, selectedMapIds, maxSelectable, onToggle }: MapSelectorProps) {
  const limitReached = selectedMapIds.length >= maxSelectable;

  return (
    <div className="flex flex-col gap-2xs">
      <span className="text-sm font-medium text-foreground">
        Map Pool ({selectedMapIds.length}/{maxSelectable})
      </span>
      <div className="flex flex-wrap gap-2xs">
        {maps.map((map) => {
          const selected = selectedMapIds.includes(map.id);
          const disabled = !selected && limitReached;

          return (
            <Button
              key={map.id}
              type="button"
              variant={selected ? "primary" : "secondary"}
              size="sm"
              disabled={disabled}
              aria-pressed={selected}
              className={cn(disabled && "opacity-40")}
              onClick={() => onToggle(map.id)}
            >
              {map.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
