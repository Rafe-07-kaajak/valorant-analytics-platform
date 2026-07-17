"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn, focusRing, Navbar, type NavLink } from "@repo/ui";
import { ThemeToggle } from "./ThemeToggle";

export function SiteNavbar({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <Navbar
      logo={
        <Link
          href="/"
          className={cn(
            "rounded-sm text-sm font-semibold text-foreground transition-opacity duration-(--duration-fast) ease-(--ease-standard) hover:opacity-80 focus-visible:opacity-80",
            focusRing,
          )}
        >
          Valorant Analytics
        </Link>
      }
      links={links}
      activeHref={pathname}
      actions={<ThemeToggle />}
    />
  );
}
