import type { CSSProperties } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { cn } from "@repo/ui";
import { usePointerGlow } from "../../hooks/usePointerGlow";
import type { VctRegion } from "../../constants/vct";
import { getRegionAccentVar } from "../../constants/regionAccent";

export interface RegionCardProps {
  region: VctRegion;
  selected: boolean;
  onSelect: () => void;
}

/**
 * Region step of the TASK-032 two-step selector. TASK-055 gives each region
 * its own identity color (tokens.css `--region-*`, defined by TASK-050 but
 * unused until now) instead of the generic brand color, and adds a Check
 * icon so the selected state never depends on color alone. Hover/focus/
 * selected micro-interactions still reference the TASK-033 shared motion
 * tokens; the card-local pointer spotlight (TASK-034) is unchanged.
 */
export function RegionCard({ region, selected, onSelect }: RegionCardProps) {
  const glow = usePointerGlow<HTMLButtonElement>();
  const accent = getRegionAccentVar(region.id);
  const style = { "--region-card-accent": accent } as CSSProperties;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      onPointerEnter={glow.onPointerEnter}
      onPointerMove={glow.onPointerMove}
      onPointerLeave={glow.onPointerLeave}
      style={style}
      className={cn(
        "group pointer-glow relative flex min-h-[44px] flex-col items-center gap-2xs rounded-md border border-surface-border bg-surface p-sm text-center",
        "motion-safe:transition-[transform,border-color,box-shadow] motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard)",
        "motion-safe:hover:-translate-y-(--lift-card-selectable) motion-safe:active:scale-(--scale-press)",
        "hover:border-(--region-card-accent)/70 focus-visible:-translate-y-(--lift-card-selectable) focus-visible:border-(--region-card-accent)/70",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        selected &&
          "border-(--region-card-accent) shadow-[0_0_0_1px_var(--region-card-accent),0_0_16px_-6px_var(--region-card-accent)]",
      )}
    >
      <Check
        aria-hidden="true"
        className={cn(
          "absolute right-1.5 top-1.5 size-3.5 motion-safe:transition-all motion-safe:duration-(--duration-base)",
          selected ? "scale-100 opacity-100" : "scale-75 opacity-0",
        )}
        style={{ color: accent }}
      />

      <span className="relative flex size-10 items-center justify-center rounded-md bg-white/[0.06] ring-1 ring-white/10">
        <span className="relative block size-7">
          <Image
            src={region.logoPath}
            alt=""
            fill
            sizes="28px"
            className="object-contain motion-safe:transition-transform motion-safe:duration-(--duration-base) motion-safe:group-hover:scale-(--scale-logo-hover) motion-safe:group-focus-visible:scale-(--scale-logo-hover)"
          />
        </span>
      </span>
      <span
        className="text-sm font-medium text-foreground motion-safe:transition-colors motion-safe:duration-(--duration-base)"
        style={{ color: selected ? accent : undefined }}
      >
        {region.name}
      </span>
    </button>
  );
}
