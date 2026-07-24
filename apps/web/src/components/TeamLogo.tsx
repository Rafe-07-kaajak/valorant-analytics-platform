"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@repo/ui";
import type { VctTeam } from "../constants/vct";

export interface TeamLogoProps {
  team: Pick<VctTeam, "name" | "shortName" | "logoPath">;
  /** Pixel size of the square tile. Defaults to 40. */
  size?: number;
  className?: string;
}

/**
 * Team crest with a missing-asset fallback, modeled on `Avatar`'s existing
 * `onError` pattern (`@repo/ui`), adapted for a square `object-contain` tile
 * (the same "neutral logo tile" convention `TeamCard`/`RegionCard` already
 * use) rather than `Avatar`'s circular/cover-fit photo treatment. Power
 * Rankings is the first place ~30+ team crests render on one page, so a
 * broken/404 logo falls back to the team's short name instead of a blank box.
 */
export function TeamLogo({ team, size = 40, className }: TeamLogoProps) {
  const [errored, setErrored] = useState(false);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/[0.06] ring-1 ring-white/10",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {errored ? (
        <span aria-hidden="true" className="text-xs font-semibold text-muted-foreground">
          {team.shortName}
        </span>
      ) : (
        <Image
          src={team.logoPath}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-contain p-1"
          onError={() => setErrored(true)}
        />
      )}
      <span className="sr-only">{team.name}</span>
    </span>
  );
}
