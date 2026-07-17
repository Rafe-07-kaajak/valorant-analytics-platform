"use client";

import Link from "next/link";
import { buttonVariants, cn } from "@repo/ui";
import { generateFeatureLinks, type AnalyticsFeature, type CanonicalUrlState } from "../lib/urlState";
import { CopyLinkButton } from "./CopyLinkButton";

export interface AnalyticsContextLinksProps {
  currentFeature: AnalyticsFeature;
  state: CanonicalUrlState;
  /** "compact" (selector-adjacent, pre-result) or "result" (anchored to a generated prediction's authoritative scenario). Only affects framing, not which links are generated. */
  placement?: "compact" | "result";
  showCopyLink?: boolean;
  className?: string;
}

/**
 * Cross-feature navigation actions (TASK-039) — renders nothing until both
 * teams are validly selected, and never links to the feature the user is
 * already on. Every href is built exclusively through `generateFeatureLinks`
 * (shared `lib/urlState` helpers), so no page hand-builds its own query
 * string.
 */
export function AnalyticsContextLinks({
  currentFeature,
  state,
  placement = "compact",
  showCopyLink = true,
  className,
}: AnalyticsContextLinksProps) {
  const links = generateFeatureLinks(currentFeature, state);
  if (links.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-sm",
        placement === "result" && "border-t border-surface-border pt-sm",
        className,
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Continue with these teams
      </span>
      <div className="flex flex-wrap items-center gap-2xs">
        {links.map((link) => (
          <Link
            key={link.feature}
            href={link.href}
            aria-label={link.ariaLabel}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            {link.label}
          </Link>
        ))}
        {showCopyLink ? <CopyLinkButton /> : null}
      </div>
    </div>
  );
}
