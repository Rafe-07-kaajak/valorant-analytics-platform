"use client";

import { type ElementType, type HTMLAttributes, type ReactNode, forwardRef, useState } from "react";
import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import { cn } from "../../lib/cn";
import { iconButtonInteraction, linkInteraction } from "../../lib/motion";
import { useScrolled } from "../../hooks/useScrolled";
import { Container } from "../Container/Container";
import { Drawer } from "../Drawer/Drawer";

export interface NavLink {
  label: string;
  href: string;
}

export interface NavbarProps extends HTMLAttributes<HTMLElement> {
  logo: ReactNode;
  links: NavLink[];
  actions?: ReactNode;
  /** Current route, used to mark the matching link as active. */
  activeHref?: string;
  /**
   * "default" (unchanged) renders the opaque surface every internal page
   * uses. "immersive" scopes the header to the dark theme's tokens
   * (`data-theme="dark"`, matching how a full-bleed dark hero already
   * scopes its own Section) and morphs from a near-transparent top-of-page
   * glass into a more solid, bordered surface once scrolled, so the bar
   * blends into a full-bleed hero/background image instead of reading as a
   * bright, detached strip. Opt-in per route.
   */
  variant?: "default" | "immersive";
  /**
   * Element rendering each nav link. Defaults to a plain anchor (this
   * package has no framework router dependency); pass Next's `Link` from the
   * app layer for client-side transitions instead of a hard page reload —
   * required for the active-route indicator below to animate between links,
   * since a hard reload tears down any in-flight animation state.
   */
  LinkComponent?: ElementType;
}

export const Navbar = forwardRef<HTMLElement, NavbarProps>(
  (
    { className, logo, links, actions, activeHref, variant = "default", LinkComponent = "a", ...props },
    ref,
  ) => {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const scrolled = useScrolled(32);
    const immersive = variant === "immersive";
    const compact = immersive && scrolled;

    return (
      <header
        ref={ref}
        data-theme={immersive ? "dark" : undefined}
        className={cn(
          "sticky top-0 z-40 backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-(--duration-base) ease-(--ease-standard)",
          immersive
            ? cn(
                "border-b",
                // /78 at rest (not fully transparent) is deliberate: the hero
                // image behind this bar varies from near-black to bright
                // artwork, and axe-core previously measured a real WCAG
                // failure on the theme-toggle button at lower opacity over a
                // bright region of the hero. /78 stays visibly translucent
                // ("blended into the scene") while keeping the dark surface
                // color dominant enough to guarantee AA contrast against any
                // hero content behind it; scrolling firms this up further.
                compact
                  ? "border-surface-border/70 bg-background/94 shadow-[var(--shadow-md)]"
                  : "border-transparent bg-background/78",
              )
            : "border-b border-surface-border bg-background/80",
          className,
        )}
        {...props}
      >
        <Container
          className={cn(
            "flex items-center justify-between gap-md transition-[height] duration-(--duration-base) ease-(--ease-standard)",
            compact ? "h-14" : "h-16",
          )}
        >
          <div className="flex items-center gap-md">
            {logo}

            <nav
              className="relative hidden items-center gap-1 rounded-lg border border-surface-border/50 bg-surface/40 p-1 backdrop-blur-sm sm:flex"
              aria-label="Primary"
            >
              {links.map((link) => {
                const isActive = link.href === activeHref;
                return (
                  <LinkComponent
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative rounded-md px-3.5 py-1.5 text-sm font-medium",
                      linkInteraction,
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-pill"
                        className="absolute inset-0 rounded-md border border-surface-border/70 bg-surface-border/60"
                        transition={{ type: "spring", stiffness: 420, damping: 36 }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="relative z-10">{link.label}</span>
                  </LinkComponent>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-sm">
            {actions}
            <button
              type="button"
              className={cn(
                "flex size-9 items-center justify-center rounded-md border border-surface-border/50 bg-surface/40 text-foreground backdrop-blur-sm hover:bg-surface-border/40 sm:hidden",
                iconButtonInteraction,
              )}
              aria-label="Open navigation menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu size={20} aria-hidden="true" />
            </button>
          </div>
        </Container>

        <Drawer
          open={mobileNavOpen}
          onOpenChange={setMobileNavOpen}
          ariaLabel="Navigation menu"
          dataTheme={immersive ? "dark" : undefined}
        >
          <nav className="flex flex-col gap-2xs" aria-label="Primary">
            {links.map((link) => {
              const isActive = link.href === activeHref;
              return (
                <LinkComponent
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setMobileNavOpen(false)}
                  className={cn(
                    "rounded-md px-xs py-2xs text-sm font-medium",
                    linkInteraction,
                    isActive
                      ? "bg-surface-border text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {link.label}
                </LinkComponent>
              );
            })}
          </nav>
        </Drawer>
      </header>
    );
  },
);

Navbar.displayName = "Navbar";
