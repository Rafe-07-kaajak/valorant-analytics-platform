"use client";

import { type HTMLAttributes, type ReactNode, forwardRef, useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "../../lib/cn";
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
}

export const Navbar = forwardRef<HTMLElement, NavbarProps>(
  ({ className, logo, links, actions, activeHref, ...props }, ref) => {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    return (
      <header
        ref={ref}
        className={cn(
          "sticky top-0 z-40 border-b border-surface-border bg-background/80 backdrop-blur-md",
          className,
        )}
        {...props}
      >
        <Container className="flex h-16 items-center justify-between gap-md">
          <div className="flex items-center gap-2xl">
            {logo}
            <nav className="hidden items-center gap-lg sm:flex">
              {links.map((link) => {
                const isActive = link.href === activeHref;
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "rounded-sm text-sm font-medium transition-colors duration-(--duration-fast) hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {link.label}
                  </a>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-sm">
            {actions}
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-md text-foreground transition-colors duration-(--duration-fast) hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:hidden"
              aria-label="Open navigation menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu size={20} aria-hidden="true" />
            </button>
          </div>
        </Container>

        <Drawer open={mobileNavOpen} onOpenChange={setMobileNavOpen} ariaLabel="Navigation menu">
          <nav className="flex flex-col gap-2xs">
            {links.map((link) => {
              const isActive = link.href === activeHref;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setMobileNavOpen(false)}
                  className={cn(
                    "rounded-md px-xs py-2xs text-sm font-medium transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                    isActive
                      ? "bg-surface-border text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
        </Drawer>
      </header>
    );
  },
);

Navbar.displayName = "Navbar";
