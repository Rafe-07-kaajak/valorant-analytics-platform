"use client";

import { useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Lock } from "lucide-react";
import { cn, focusRing, Meter, MotionNumber } from "@repo/ui";
import { TeamLogo } from "../../components/TeamLogo";
import { getRegionAccentVar } from "../../constants/regionAccent";
import { RankMovementBadge } from "./RankMovementBadge";
import { resolveRecentFormIndex } from "./rankingModel";
import type { PowerRankingEntry } from "./rankingTypes";

export interface SealedRankingCardProps {
  entry: PowerRankingEntry;
  /** 1, 2, or 3 — the podium position shown on the front/back face. */
  primaryRank: number;
  /** Only passed in Regional mode, e.g. "Global #7". */
  secondaryRankLabel?: string;
  /** "Global" or the region's display name — used only for accessible names. */
  scopeLabel: string;
  revealed: boolean;
  onReveal: () => void;
  onOpenDossier: () => void;
  className?: string;
}

const MAX_TILT_DEGREES = 6;
const FLIP_DURATION_SECONDS = 0.52;

/**
 * A Top 3 podium card that conceals a team's identity until revealed. Motion
 * is split across two nested layers so the pointer-tilt hover effect and the
 * reveal flip never fight over the same `transform`:
 *  - the outer element owns hover lift/scale/tilt, driven by CSS custom
 *    properties (`--pr-lift`/`--pr-scale` toggled by `hover:`/`focus-within:`
 *    utilities, `--pr-tilt-x`/`--pr-tilt-y` written directly on pointer move,
 *    matching the direct-DOM-write, no-rerender pattern `usePointerGlow`
 *    already uses elsewhere in this app) and hosts the 3D `perspective`.
 *  - the inner element owns the reveal flip itself (Framer's `rotateY`
 *    motion value), so the two transforms compose across the parent/child
 *    boundary instead of overwriting one another.
 */
export function SealedRankingCard({
  entry,
  primaryRank,
  secondaryRankLabel,
  scopeLabel,
  revealed,
  onReveal,
  onOpenDossier,
  className,
}: SealedRankingCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const outerRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<DOMRect | null>(null);

  const onPointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || prefersReducedMotion) return;
    rectRef.current = event.currentTarget.getBoundingClientRect();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || prefersReducedMotion) return;
    const rect = rectRef.current;
    const node = outerRef.current;
    if (!rect || !node) return;
    const relativeX = (event.clientX - rect.left) / rect.width;
    const relativeY = (event.clientY - rect.top) / rect.height;
    node.style.setProperty("--pr-tilt-x", `${(relativeY - 0.5) * -2 * MAX_TILT_DEGREES}deg`);
    node.style.setProperty("--pr-tilt-y", `${(relativeX - 0.5) * 2 * MAX_TILT_DEGREES}deg`);
    node.style.setProperty("--pr-glow-x", `${relativeX * 100}%`);
    node.style.setProperty("--pr-glow-y", `${relativeY * 100}%`);
  };

  const onPointerLeave = () => {
    rectRef.current = null;
    const node = outerRef.current;
    if (!node) return;
    node.style.setProperty("--pr-tilt-x", "0deg");
    node.style.setProperty("--pr-tilt-y", "0deg");
  };

  const isRealData = entry.dataConfidence !== undefined;
  const accessibleName = revealed
    ? `${entry.team.name}, ${scopeLabel} rank ${primaryRank}, ${isRealData ? "real-data" : "modeled"} Power Score ${entry.powerScore}`
    : `Reveal ${scopeLabel} rank ${primaryRank} team`;

  const outerStyle: CSSProperties = {
    perspective: "1000px",
    transform: "translateY(var(--pr-lift, 0px)) scale(var(--pr-scale, 1)) rotateX(var(--pr-tilt-x, 0deg)) rotateY(var(--pr-tilt-y, 0deg))",
  };

  const outerClassName = cn(
    "relative aspect-[3/4] w-full",
    "motion-safe:transition-transform motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard)",
    "motion-safe:hover:[--pr-lift:-10px] motion-safe:hover:[--pr-scale:1.03]",
    "motion-safe:focus-within:[--pr-lift:-10px] motion-safe:focus-within:[--pr-scale:1.03]",
    className,
  );

  const faceClassName = "absolute inset-0 [backface-visibility:hidden] flex flex-col rounded-xl border border-surface-border";

  return (
    <div
      ref={outerRef}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerLeave}
      className={outerClassName}
      style={outerStyle}
    >
      <motion.div
        className="relative size-full [transform-style:preserve-3d]"
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: FLIP_DURATION_SECONDS, ease: [0.16, 1, 0.3, 1] }
        }
      >
        <button
          type="button"
          onClick={onReveal}
          aria-label={accessibleName}
          aria-hidden={revealed}
          tabIndex={revealed ? -1 : 0}
          className={cn(
            faceClassName,
            "items-center justify-center gap-sm overflow-hidden p-md text-center",
            focusRing,
          )}
          style={{
            backgroundImage: `linear-gradient(160deg, color-mix(in oklab, ${getRegionAccentVar(entry.team.region)} 35%, var(--surface-raised)) 0%, var(--surface-raised) 70%)`,
          }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:repeating-linear-gradient(180deg,var(--foreground)_0,var(--foreground)_1px,transparent_1px,transparent_4px)]"
          />
          <Lock aria-hidden="true" className="relative size-6 text-muted-foreground" />
          <span className="relative text-4xl font-bold text-foreground">#{primaryRank}</span>
          <span className="relative text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {scopeLabel} · Sealed Rank
          </span>
          <span className="relative text-xs font-medium text-foreground opacity-70">Press Enter to reveal</span>
        </button>

        <div
          aria-hidden={!revealed}
          className={cn(faceClassName, "gap-sm bg-surface p-sm [transform:rotateY(180deg)]")}
        >
          <div className="flex items-center gap-sm">
            <TeamLogo team={entry.team} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{entry.team.name}</p>
              <p className="text-xs text-muted-foreground">
                {scopeLabel} #{primaryRank}
                {secondaryRankLabel ? ` · ${secondaryRankLabel}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Power Score</span>
            <MotionNumber
              value={entry.powerScore}
              format="decimal"
              decimals={2}
              className="text-xl font-semibold text-foreground"
            />
          </div>

          <Meter label={isRealData ? "Recent form" : "Recent form (modeled)"} value={resolveRecentFormIndex(entry)} tone="brand" />

          <RankMovementBadge className="self-start" />

          <button
            type="button"
            onClick={onOpenDossier}
            tabIndex={revealed ? 0 : -1}
            className={cn(
              "mt-auto rounded-md border border-surface-border bg-surface-raised px-xs py-2xs text-xs font-medium text-foreground",
              "motion-safe:transition-colors motion-safe:duration-(--duration-fast) hover:border-brand-400/70",
              focusRing,
            )}
          >
            View full dossier
          </button>
        </div>
      </motion.div>
    </div>
  );
}
