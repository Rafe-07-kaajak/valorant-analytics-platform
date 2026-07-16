import { cn } from "../../lib/cn";

const toneClasses = {
  brand: { track: "bg-brand-400/25", fill: "bg-brand-500" },
  success: { track: "bg-badge-success-bg", fill: "bg-badge-success-text" },
  danger: { track: "bg-badge-danger-bg", fill: "bg-badge-danger-text" },
} as const;

export interface MeterProps {
  value: number;
  max?: number;
  label: string;
  valueLabel?: string;
  tone?: keyof typeof toneClasses;
  className?: string;
}

export function Meter({ value, max = 100, label, valueLabel, tone = "brand", className }: MeterProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn("flex flex-col gap-2xs", className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold text-foreground">
          {valueLabel ?? `${Math.round(percent)}%`}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cn("h-2 w-full overflow-hidden rounded-full", toneClasses[tone].track)}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-(--duration-base) ease-(--ease-standard)",
            toneClasses[tone].fill,
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
