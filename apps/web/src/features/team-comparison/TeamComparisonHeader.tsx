import Image from "next/image";
import { Swords } from "lucide-react";

/**
 * TASK-057 — dedicated "tactical faceoff" header for Comparison Lab,
 * visually distinct from Prediction Studio's plain text header and
 * Historical Replay's archive-console header. No readiness/model status
 * badges here — unlike Historical Replay, this feature has no live
 * availability signal to report, so the header stays to title + framing
 * copy rather than inventing status indicators.
 */
export function TeamComparisonHeader() {
  return (
    <div className="relative flex min-h-[200px] flex-col justify-end gap-sm overflow-hidden rounded-lg border border-surface-border p-md md:min-h-[240px]">
      <Image
        src="/assets/redesign/tool-headers/comparison-lab-header.png"
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        loading="lazy"
        className="hidden object-cover md:block"
      />
      <Image
        src="/assets/redesign/tool-headers/comparison-lab-header-mobile.png"
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
            <Swords className="size-4" aria-hidden="true" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Analytical faceoff
          </span>
        </div>

        <div>
          <h1 className="text-lg font-semibold text-foreground">Team Comparison Lab</h1>
          <p className="text-sm text-muted-foreground">
            Select any two of the 32 VCT Stage 1 teams to compare their modeled profiles side by side,
            no match prediction required.
          </p>
        </div>
      </div>
    </div>
  );
}
