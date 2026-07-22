import type { CSSProperties } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { cn } from "@repo/ui";
import { usePointerGlow } from "../../hooks/usePointerGlow";
import type { VctTeam } from "../../constants/vct";
import { getRegionAccentVar } from "../../constants/regionAccent";

export interface TeamCardProps {
  team: VctTeam;
  side: "A" | "B";
  selected: boolean;
  /** When set, the card is disabled and this text explains why (surfaced to assistive tech). */
  disabledReason?: string;
  onSelect: () => void;
}

/**
 * Team step of the TASK-032 two-step selector. Kept focusable (aria-disabled
 * rather than the native `disabled` attribute) even when unavailable, so a
 * screen reader user can still reach the card and hear why, per TASK-032's
 * accessibility requirements. Hover/focus/selected micro-interactions
 * reference the TASK-033 shared motion tokens rather than one-off values.
 * TASK-034 adds a card-local pointer spotlight ("pointer-glow"), tinted
 * cyan for Team A / coral for Team B — weaker than the selected-state glow
 * below by design, and never attached at all when the card is disabled.
 * TASK-055 adds the team's region identity color as a small accent stripe
 * (region is never conveyed by color alone elsewhere — the region name is
 * still visible on SelectedTeamSummary) and a neutral logo tile behind
 * every crest so a black-on-transparent logo still reads against the dark
 * surface without inverting or otherwise altering the source asset.
 */
export function TeamCard({ team, side, selected, disabledReason, onSelect }: TeamCardProps) {
  const disabled = Boolean(disabledReason);
  const accent = side === "A" ? "team-a" : "team-b";
  const regionAccent = getRegionAccentVar(team.region);
  const reasonId = disabled ? `${team.id}-${side}-disabled-reason` : undefined;
  const glow = usePointerGlow<HTMLButtonElement>();
  const spotlightStyle = {
    "--spotlight-color": `color-mix(in oklab, var(--${accent}) 20%, transparent)`,
  } as CSSProperties;

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-disabled={disabled}
      aria-describedby={reasonId}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      style={disabled ? undefined : spotlightStyle}
      onPointerEnter={disabled ? undefined : glow.onPointerEnter}
      onPointerMove={disabled ? undefined : glow.onPointerMove}
      onPointerLeave={disabled ? undefined : glow.onPointerLeave}
      className={cn(
        "group relative flex min-h-[44px] flex-col items-center gap-2xs overflow-hidden rounded-md border border-surface-border bg-surface p-sm text-center",
        !disabled && "pointer-glow",
        "motion-safe:transition-[transform,border-color,box-shadow] motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard)",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        disabled
          ? "cursor-not-allowed opacity-40 pointer-events-none"
          : cn(
              "motion-safe:hover:-translate-y-(--lift-card-selectable) motion-safe:focus-visible:-translate-y-(--lift-card-selectable) motion-safe:active:scale-(--scale-press)",
              accent === "team-a" ? "hover:border-team-a/70 focus-visible:border-team-a/70" : "hover:border-team-b/70 focus-visible:border-team-b/70",
            ),
        selected &&
          (accent === "team-a"
            ? "border-team-a shadow-[0_0_0_1px_var(--color-team-a),0_0_16px_-6px_var(--color-team-a)]"
            : "border-team-b shadow-[0_0_0_1px_var(--color-team-b),0_0_16px_-6px_var(--color-team-b)]"),
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: regionAccent }}
      />

      <Check
        aria-hidden="true"
        className={cn(
          "absolute right-1.5 top-2.5 size-4 motion-safe:transition-all motion-safe:duration-(--duration-base)",
          selected ? "scale-100 opacity-100" : "scale-75 opacity-0",
          accent === "team-a" ? "text-team-a" : "text-team-b",
        )}
      />

      <span className="relative mt-1 flex size-12 items-center justify-center rounded-md bg-white/[0.06] ring-1 ring-white/10">
        <Image
          src={team.logoPath}
          alt=""
          fill
          sizes="48px"
          className={cn(
            "object-contain p-1.5 motion-safe:transition-transform motion-safe:duration-(--duration-base)",
            !disabled && "motion-safe:group-hover:scale-(--scale-logo-hover) motion-safe:group-focus-visible:scale-(--scale-logo-hover)",
          )}
        />
      </span>
      <span
        className={cn(
          "text-sm font-medium text-foreground motion-safe:transition-colors motion-safe:duration-(--duration-base)",
          !disabled &&
            (accent === "team-a"
              ? "motion-safe:group-hover:text-team-a motion-safe:group-focus-visible:text-team-a"
              : "motion-safe:group-hover:text-team-b motion-safe:group-focus-visible:text-team-b"),
        )}
      >
        {team.name}
      </span>
      <span className="text-xs text-muted-foreground">{team.shortName}</span>
      {reasonId ? (
        <span id={reasonId} className="sr-only">
          {disabledReason}
        </span>
      ) : null}
    </button>
  );
}
