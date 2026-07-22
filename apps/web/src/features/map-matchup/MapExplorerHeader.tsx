import Image from "next/image";
import { Radar } from "lucide-react";

/**
 * TASK-058 — dedicated "spatial console" header for Map Explorer, visually
 * distinct from Prediction Studio's plain text header, Historical Replay's
 * archive-console header, and Comparison Lab's faceoff header. No readiness
 * badges (this feature has no live availability signal, same reasoning as
 * Comparison Lab's header). The `<h1>` text is kept exactly "Map Matchup
 * Explorer" — e2e/map-matchup.spec.ts asserts this literal heading name, and
 * the route's own nav label ("Map Explorer") already lives elsewhere.
 */
export function MapExplorerHeader() {
  return (
    <div className="relative flex min-h-[200px] flex-col justify-end gap-sm overflow-hidden rounded-lg border border-surface-border p-md md:min-h-[240px]">
      <Image
        src="/assets/redesign/tool-headers/map-explorer-header.png"
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        loading="lazy"
        className="hidden object-cover md:block"
      />
      <Image
        src="/assets/redesign/tool-headers/map-explorer-header-mobile.png"
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        loading="lazy"
        className="object-cover md:hidden"
      />
      <div className="pointer-events-none absolute inset-0 bg-background/80" aria-hidden="true" />

      <div className="relative flex flex-col gap-sm">
        <div className="flex items-center gap-2xs">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-surface-border bg-badge-info-bg text-badge-info-text">
            <Radar className="size-4" aria-hidden="true" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Spatial intelligence console
          </span>
        </div>

        <div>
          <h1 className="text-lg font-semibold text-foreground">Map Matchup Explorer</h1>
          <p className="text-sm text-muted-foreground">
            Select any two of the 32 VCT Stage 1 teams and inspect their modeled matchup across every
            supported map.
          </p>
        </div>
      </div>
    </div>
  );
}
