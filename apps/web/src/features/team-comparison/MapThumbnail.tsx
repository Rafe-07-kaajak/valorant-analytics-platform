import Image from "next/image";
import { cn } from "@repo/ui";
import { getMapArtworkPath } from "../prediction-studio/mapArtwork";

export interface MapThumbnailProps {
  mapId: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * TASK-057 — compact artwork-backed map identity, reused everywhere
 * Comparison Lab names a specific map (MapHighlightCard, MapsTab rows) so no
 * map ever falls back to a letter-only badge. Reuses the same
 * `getMapArtworkPath` lookup Prediction Studio's `MapSelector` already
 * established (TASK-055) rather than duplicating a second map-artwork
 * mapping. Purely decorative — every call site already renders the map name
 * as its own visible text node, so this stays `aria-hidden` rather than
 * repeating that name a second time for assistive tech.
 */
export function MapThumbnail({ mapId, size = "sm", className }: MapThumbnailProps) {
  const artworkPath = getMapArtworkPath(mapId);
  const dimension = size === "md" ? "size-14" : "size-10";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-surface-border bg-surface",
        dimension,
        className,
      )}
    >
      {artworkPath ? <Image src={artworkPath} alt="" fill sizes="56px" className="object-cover" /> : null}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
    </span>
  );
}
