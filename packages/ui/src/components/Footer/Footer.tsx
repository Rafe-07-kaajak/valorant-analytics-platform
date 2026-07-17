import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { linkInteraction } from "../../lib/motion";
import { Container } from "../Container/Container";

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterProps {
  logo: ReactNode;
  tagline: string;
  links: FooterLink[];
}

export function Footer({ logo, tagline, links }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-surface-border">
      <Container className="flex flex-col gap-md py-2xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2xs">
          {logo}
          <p className="text-sm text-muted-foreground">{tagline}</p>
        </div>
        <div className="flex items-center gap-lg">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline",
                linkInteraction,
              )}
            >
              {link.label}
            </a>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">© {year} Valorant Analytics Platform</p>
      </Container>
    </footer>
  );
}
