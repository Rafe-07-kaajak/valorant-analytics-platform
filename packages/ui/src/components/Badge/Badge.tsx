import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

const toneClasses = {
  neutral: "bg-surface-border text-foreground",
  success: "bg-badge-success-bg text-badge-success-text",
  danger: "bg-badge-danger-bg text-badge-danger-text",
  brand: "bg-badge-brand-bg text-badge-brand-text",
} as const;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof toneClasses;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone = "neutral", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2xs py-[0.125rem] text-xs font-medium",
          toneClasses[tone],
          className,
        )}
        {...props}
      />
    );
  },
);

Badge.displayName = "Badge";
