import { cn } from "../../lib/cn";

export interface MeterProps {
  value: number;
  max?: number;
  label: string;
  valueLabel?: string;
  className?: string;
}

export function Meter({ value, max = 100, label, valueLabel, className }: MeterProps) {
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
        className="h-2 w-full overflow-hidden rounded-full bg-brand-400/25"
      >
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-(--duration-base) ease-(--ease-standard)"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
