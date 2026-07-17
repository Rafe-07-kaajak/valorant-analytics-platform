import type { CSSProperties } from "react";
import Image from "next/image";
import { Badge, cn } from "@repo/ui";
import { usePointerGlow } from "../../hooks/usePointerGlow";
import { getRegionById, type VctTeam } from "../../constants/vct";

export interface SelectedTeamSummaryProps {
  team: VctTeam;
  side: "A" | "B";
}

/** TASK-034: a fainter pointer-glow than the interactive TeamCard above it —
 * this panel is a static display, not a control, so its glow stays subtle
 * enough not to imply it's clickable (Level 4 in the interaction hierarchy). */
export function SelectedTeamSummary({ team, side }: SelectedTeamSummaryProps) {
  const region = getRegionById(team.region);
  const accent = side === "A" ? "team-a" : "team-b";
  const glow = usePointerGlow<HTMLDivElement>();
  const spotlightStyle = {
    "--spotlight-color": `color-mix(in oklab, var(--${accent}) 12%, transparent)`,
  } as CSSProperties;

  return (
    <div
      onPointerEnter={glow.onPointerEnter}
      onPointerMove={glow.onPointerMove}
      onPointerLeave={glow.onPointerLeave}
      style={spotlightStyle}
      className={cn(
        "pointer-glow flex items-center gap-sm rounded-md border bg-surface p-sm",
        accent === "team-a" ? "border-team-a" : "border-team-b",
      )}
    >
      <span className="relative block size-16 shrink-0">
        <Image src={team.logoPath} alt="" fill sizes="64px" className="object-contain" />
      </span>
      <div className="flex flex-col gap-3xs">
        <span className="flex items-center gap-3xs text-xs font-semibold uppercase tracking-wide text-foreground">
          {/* A colored dot rather than colored text — text-team-a/text-team-b fails WCAG AA
              contrast at this size against the surface background, per docs/tokens.css's own
              "comparison charts" scope for that color pair. Follows TeamDnaCard's precedent. */}
          <span
            className={cn("inline-block size-2.5 rounded-full", accent === "team-a" ? "bg-team-a" : "bg-team-b")}
            aria-hidden="true"
          />
          Team {side}
        </span>
        <span className="font-medium text-foreground">{team.name}</span>
        <div className="flex flex-wrap items-center gap-2xs">
          <span className="text-sm text-muted-foreground">{team.shortName}</span>
          {region ? <Badge tone="neutral">{region.name}</Badge> : null}
        </div>
      </div>
    </div>
  );
}
