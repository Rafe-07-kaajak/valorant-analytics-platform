import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";
import { focusRing } from "../../lib/motion";
import { Spinner } from "../Spinner";

/**
 * TASK-050 — variant hierarchy. `primary`, `secondary`, and `ghost` are the
 * pre-existing variants and keep their exact prior classes, so no existing
 * call site changes appearance. `tertiary`, `destructive`, and
 * `highEmphasis` are additive: they round out the button hierarchy the
 * design foundation calls for, available for TASK-051+ page work to opt
 * into. See docs/38-visual-foundation-and-design-tokens.md.
 */
const variantClasses = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 motion-safe:hover:shadow-[0_8px_20px_-8px_var(--color-brand-500)]",
  secondary:
    "bg-surface text-foreground border border-surface-border hover:bg-surface-border hover:border-foreground/25",
  ghost: "text-foreground hover:bg-surface",
  /* Lower emphasis than secondary: no border, no fill, only a text/hover
     treatment tinted toward the brand color rather than neutral foreground. */
  tertiary: "text-brand-500 hover:bg-brand-500/10",
  /* Irreversible/destructive actions — danger token, not a one-off red. */
  destructive:
    "bg-danger text-white hover:opacity-90 motion-safe:hover:shadow-[0_8px_20px_-8px_var(--color-danger)]",
  /* Gradient CTA for a single high-emphasis moment per view (hero, primary
     conversion action) — not a replacement for `primary`, which remains the
     default interactive button. */
  highEmphasis:
    "text-white bg-[image:var(--gradient-button)] hover:brightness-110 motion-safe:hover:shadow-[0_10px_28px_-10px_var(--color-brand-500)]",
  /* Domain-agnostic by design: packages/ui has no knowledge of VCT regions,
     so the accent color is a CSS custom property the caller sets via
     `style={{ "--button-region-color": "var(--color-region-pacific)" }}`
     (falls back to the brand color if unset). */
  regionAccented:
    "text-white bg-[var(--button-region-color,var(--color-brand-500))] hover:brightness-110",
} as const;

const sizeClasses = {
  sm: "h-8 px-3 text-sm rounded-sm",
  md: "h-10 px-4 text-sm rounded-md",
  lg: "h-12 px-6 text-base rounded-md",
  /* Square footprint for a single icon child, no label. */
  icon: "size-10 rounded-md",
} as const;

export interface ButtonVariantOptions {
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
  className?: string;
}

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: ButtonVariantOptions = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-medium",
    "transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-fast) ease-(--ease-standard)",
    "motion-safe:hover:-translate-y-(--lift-button) motion-safe:focus-visible:-translate-y-(--lift-button)",
    "motion-safe:active:translate-y-0 motion-safe:active:scale-(--scale-press)",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:translate-y-0",
    focusRing,
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
  /** Shows the shared Spinner in place of the label and disables the button. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={buttonVariants({ variant, size, className })}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Spinner size={16} label="Loading" className="text-current" /> : children}
      </button>
    );
  },
);

Button.displayName = "Button";
