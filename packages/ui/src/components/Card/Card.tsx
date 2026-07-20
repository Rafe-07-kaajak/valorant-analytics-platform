import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

/**
 * TASK-050 — card hierarchy. `informational` reproduces the pre-existing
 * (variant-less) Card classes exactly, so every current call site — which
 * passes no `variant` — renders unchanged. The rest are additive, available
 * for TASK-051+ page work to opt into. See
 * docs/38-visual-foundation-and-design-tokens.md for when to use each.
 */
const variantClasses = {
  informational: "rounded-lg border border-surface-border bg-surface p-md shadow-sm",
  interactive:
    "rounded-lg border border-surface-border bg-surface p-md shadow-sm cursor-pointer motion-safe:transition-[transform,border-color,box-shadow] motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard) hover:border-brand-400/70 motion-safe:hover:-translate-y-(--lift-card-info)",
  selected:
    "rounded-lg border border-brand-400 bg-surface p-md shadow-[var(--glow-selected)]",
  metric: "rounded-lg border border-surface-border bg-surface-raised p-md shadow-sm",
  result: "rounded-lg border border-surface-border border-t-2 border-t-(--border-accent) bg-surface p-md shadow-sm",
  feature: "rounded-xl border border-surface-border bg-surface-raised p-lg shadow-md",
  glass: "rounded-lg border border-(--border-hairline) bg-surface-glass p-md shadow-sm backdrop-blur-md",
  editorial: "rounded-none border-b border-(--border-hairline) bg-transparent p-lg",
} as const;

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof variantClasses;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "informational", ...props }, ref) => {
    return <div ref={ref} className={cn(variantClasses[variant], className)} {...props} />;
  },
);

Card.displayName = "Card";
