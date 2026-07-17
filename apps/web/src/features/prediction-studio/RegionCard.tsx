import Image from "next/image";
import { cn } from "@repo/ui";
import type { VctRegion } from "../../constants/vct";

export interface RegionCardProps {
  region: VctRegion;
  selected: boolean;
  onSelect: () => void;
}

/**
 * Region step of the TASK-032 two-step selector. Hover/focus/selected
 * micro-interactions reference the TASK-033 shared motion tokens
 * (apps/web/src/styles/tokens.css) rather than one-off arbitrary values.
 */
export function RegionCard({ region, selected, onSelect }: RegionCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "group flex min-h-[44px] flex-col items-center gap-2xs rounded-md border border-surface-border bg-surface p-sm text-center",
        "motion-safe:transition-[transform,border-color,box-shadow] motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard)",
        "motion-safe:hover:-translate-y-(--lift-card-selectable) motion-safe:active:scale-(--scale-press)",
        "hover:border-brand-400/70 focus-visible:-translate-y-(--lift-card-selectable) focus-visible:border-brand-400/70",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        selected && "border-brand-400 shadow-[0_0_0_1px_var(--color-brand-400),0_0_16px_-6px_var(--color-brand-400)]",
      )}
    >
      <span className="relative block size-10">
        <Image
          src={region.logoPath}
          alt=""
          fill
          sizes="40px"
          className="object-contain motion-safe:transition-transform motion-safe:duration-(--duration-base) motion-safe:group-hover:scale-(--scale-logo-hover) motion-safe:group-focus-visible:scale-(--scale-logo-hover)"
        />
      </span>
      <span className="text-sm font-medium text-foreground motion-safe:transition-colors motion-safe:duration-(--duration-base) motion-safe:group-hover:text-brand-400 motion-safe:group-focus-visible:text-brand-400">
        {region.name}
      </span>
    </button>
  );
}
