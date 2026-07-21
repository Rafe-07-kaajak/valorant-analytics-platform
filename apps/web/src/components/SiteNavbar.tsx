"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Radar } from "lucide-react";
import { cn, focusRing, Navbar, type NavLink } from "@repo/ui";

export function SiteNavbar({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  // Only the landing page opens on a full-bleed cinematic hero; internal
  // tool pages keep the default opaque navbar so their content underneath
  // never needs its own dark scrim to stay readable.
  const isLanding = pathname === "/";

  return (
    <Navbar
      variant={isLanding ? "immersive" : "default"}
      LinkComponent={Link}
      logo={
        <Link
          href="/"
          className={cn(
            "group flex items-center gap-2 rounded-lg border bg-surface/40 px-3 py-1.5 backdrop-blur-sm transition-colors duration-(--duration-fast) ease-(--ease-standard) hover:border-brand-400/50",
            isLanding ? "border-brand-400/40" : "border-surface-border/50",
            focusRing,
          )}
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-badge-brand-bg text-badge-brand-text">
            <Radar className="size-3.5" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold text-foreground">Valorant Analytics</span>
        </Link>
      }
      links={links}
      activeHref={pathname}
    />
  );
}
