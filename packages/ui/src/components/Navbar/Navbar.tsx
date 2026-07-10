import { type HTMLAttributes, type ReactNode, forwardRef } from "react";
import { cn } from "../../lib/cn";
import { Container } from "../Container/Container";

export interface NavLink {
  label: string;
  href: string;
}

export interface NavbarProps extends HTMLAttributes<HTMLElement> {
  logo: ReactNode;
  links: NavLink[];
  actions?: ReactNode;
}

export const Navbar = forwardRef<HTMLElement, NavbarProps>(
  ({ className, logo, links, actions, ...props }, ref) => {
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
            <nav className="flex items-center gap-lg">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
          {actions ? <div className="flex items-center gap-sm">{actions}</div> : null}
        </Container>
      </header>
    );
  },
);

Navbar.displayName = "Navbar";
