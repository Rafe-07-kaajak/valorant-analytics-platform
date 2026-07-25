import Link from "next/link";
import { Radar } from "lucide-react";
import { Badge, cn, Container, Divider, focusRing, type NavLink } from "@repo/ui";

const IDENTITY_LABELS = [
  "Product Design",
  "Frontend Engineering",
  "Machine Learning",
  "Data Engineering",
  "Platform Engineering",
] as const;

/**
 * TASK-053 — the footer redesign. Deliberately not built on the generic
 * `packages/ui` `Footer` (a plain logo/tagline/links bar): this content —
 * personal signature, project framing, unofficial-project disclosure — is
 * app-specific identity copy, not a reusable design-system primitive, the
 * same reasoning `docs/39` already gives for keeping `CardSpotlight` in
 * `apps/web` instead of `packages/ui`. `Footer` itself is left in place
 * (still exported, still a valid generic primitive) since nothing else in
 * the repo constrains it — this component simply stops being its only
 * consumer.
 *
 * No GitHub/source link is rendered: the repository has no such URL
 * anywhere (checked before writing this), and inventing one would violate
 * the "do not add unsupported URLs" instruction.
 */
export function SiteFooter({ links }: { links: NavLink[] }) {
  const year = new Date().getFullYear();

  return (
    <footer data-theme="dark" className="relative overflow-hidden border-t border-surface-border/60">
      <div
        className="pointer-events-none absolute inset-0 bg-[url('/assets/redesign/textures/tactical-grid.png')] bg-repeat opacity-[0.04]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[url('/assets/redesign/overlays/node-network.png')] bg-cover bg-center opacity-[0.05]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-background/97 to-background"
        aria-hidden="true"
      />

      <Container className="relative flex flex-col gap-xl py-2xl">
        <div className="grid gap-xl md:grid-cols-[1.3fr_1fr_1fr]">
          <div className="flex flex-col gap-md" style={{ minWidth: 0 }}>
            <Link
              href="/"
              className={cn(
                "flex w-fit items-center gap-2 rounded-lg border border-surface-border/50 bg-surface/40 px-3 py-1.5 backdrop-blur-sm transition-colors duration-(--duration-fast) ease-(--ease-standard) hover:border-brand-400/50",
                focusRing,
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-badge-brand-bg text-badge-brand-text">
                <Radar className="size-3.5" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-foreground">Valorant Analytics</span>
            </Link>

            {/* Not `max-w-sm`: this project's tokens.css registers a
                same-named `--spacing-sm` (1rem) utility scale, which
                Tailwind resolves before its own container/max-width scale
                for the "sm" key, collapsing the paragraph to 16px. A plain
                pixel value sidesteps the collision entirely. */}
            <p className="text-sm leading-relaxed text-muted-foreground" style={{ maxWidth: "24rem" }}>
              An explainable-prediction platform for professional VALORANT, designed and built
              end to end by <span className="font-medium text-foreground">Phan Huy Hoang</span>,
              also known as <span className="font-medium text-foreground">Bernazlt</span>.
            </p>

            <div className="flex flex-wrap gap-2xs" aria-label="Areas of work">
              {IDENTITY_LABELS.map((label) => (
                <Badge key={label} tone="neutral">
                  {label}
                </Badge>
              ))}
            </div>
          </div>

          <nav className="flex flex-col gap-sm" aria-label="Footer">
            <p
              className="text-xs font-semibold uppercase text-muted-foreground"
              style={{ letterSpacing: "0.14em" }}
            >
              Navigate
            </p>
            <ul className="flex flex-col gap-2" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      "rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline",
                      focusRing,
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex flex-col gap-sm" style={{ minWidth: 0 }}>
            <p
              className="text-xs font-semibold uppercase text-muted-foreground"
              style={{ letterSpacing: "0.14em" }}
            >
              Project
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Personal experimental project, fan-made and unofficial. Not affiliated with or
              endorsed by Riot Games. VALORANT and Riot Games are trademarks or registered
              trademarks of Riot Games, Inc.
            </p>
          </div>
        </div>

        <Divider />

        <p className="text-xs text-muted-foreground">
          © {year} Phan Huy Hoang (Bernazlt). Personal experimental project.
        </p>
      </Container>
    </footer>
  );
}
