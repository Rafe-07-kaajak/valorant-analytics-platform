import Image from "next/image";
import { Check } from "lucide-react";
import { cn } from "@repo/ui";
import type { VctTeam } from "../../constants/vct";

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
 * accessibility requirements.
 */
export function TeamCard({ team, side, selected, disabledReason, onSelect }: TeamCardProps) {
  const disabled = Boolean(disabledReason);
  const accent = side === "A" ? "team-a" : "team-b";
  const reasonId = disabled ? `${team.id}-${side}-disabled-reason` : undefined;

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-disabled={disabled}
      aria-describedby={reasonId}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      className={cn(
        "group relative flex min-h-[44px] flex-col items-center gap-2xs rounded-md border border-surface-border bg-surface p-sm text-center",
        "motion-safe:transition-[transform,border-color,box-shadow] motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard)",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        disabled
          ? "cursor-not-allowed opacity-40 pointer-events-none"
          : cn(
              "motion-safe:hover:-translate-y-[3px] motion-safe:focus-visible:-translate-y-[3px] motion-safe:active:scale-[0.97]",
              accent === "team-a" ? "hover:border-team-a/70 focus-visible:border-team-a/70" : "hover:border-team-b/70 focus-visible:border-team-b/70",
            ),
        selected &&
          (accent === "team-a"
            ? "border-team-a shadow-[0_0_0_1px_var(--color-team-a),0_0_16px_-6px_var(--color-team-a)]"
            : "border-team-b shadow-[0_0_0_1px_var(--color-team-b),0_0_16px_-6px_var(--color-team-b)]"),
      )}
    >
      <Check
        aria-hidden="true"
        className={cn(
          "absolute right-1.5 top-1.5 size-4 motion-safe:transition-all motion-safe:duration-(--duration-base)",
          selected ? "scale-100 opacity-100" : "scale-75 opacity-0",
          accent === "team-a" ? "text-team-a" : "text-team-b",
        )}
      />
      <span className="relative block size-12">
        <Image
          src={team.logoPath}
          alt=""
          fill
          sizes="48px"
          className={cn(
            "object-contain motion-safe:transition-transform motion-safe:duration-(--duration-base)",
            !disabled && "motion-safe:group-hover:scale-[1.03] motion-safe:group-focus-visible:scale-[1.03]",
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
