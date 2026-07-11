"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Navbar, type NavLink } from "@repo/ui";
import { ThemeToggle } from "./ThemeToggle";

export function SiteNavbar({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <Navbar
      logo={
        <Link href="/" className="text-sm font-semibold text-foreground">
          Valorant Analytics
        </Link>
      }
      links={links}
      activeHref={pathname}
      actions={<ThemeToggle />}
    />
  );
}
