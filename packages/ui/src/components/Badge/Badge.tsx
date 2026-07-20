import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

const toneClasses = {
  /* Kept as the pre-existing value — this is the default tone and every
     current call site relies on it rendering unchanged. */
  neutral: "bg-surface-border text-foreground",
  success: "bg-badge-success-bg text-badge-success-text",
  danger: "bg-badge-danger-bg text-badge-danger-text",
  brand: "bg-badge-brand-bg text-badge-brand-text",
  /* TASK-050 additions — round out the semantic set and add VCT region
     identity tones. `neutralStatus` is distinct from the pre-existing
     `neutral` (a generic gray chip): it's specifically the neutral member
     of the success/warning/danger/info/neutral status-color family, for
     "pending" / "no data" style indicators. */
  info: "bg-badge-info-bg text-badge-info-text",
  neutralStatus: "bg-badge-neutral-bg text-badge-neutral-text",
  regionAmericas: "bg-badge-region-americas-bg text-badge-region-americas-text",
  regionEmea: "bg-badge-region-emea-bg text-badge-region-emea-text",
  regionPacific: "bg-badge-region-pacific-bg text-badge-region-pacific-text",
  regionChina: "bg-badge-region-china-bg text-badge-region-china-text",
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
