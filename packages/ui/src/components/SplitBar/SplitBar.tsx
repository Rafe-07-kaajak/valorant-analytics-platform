import { cn } from "../../lib/cn";

export interface SplitBarSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface SplitBarProps {
  segments: [SplitBarSegment, SplitBarSegment];
  className?: string;
}

export function SplitBar({ segments, className }: SplitBarProps) {
  const total = segments[0].value + segments[1].value || 1;

  return (
    <div className={cn("flex flex-col gap-2xs", className)}>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-border">
        {segments.map((segment, index) => (
          <div
            key={segment.id}
            className={cn("h-full", index === 0 ? "mr-px" : "ml-px")}
            style={{
              width: `${(segment.value / total) * 100}%`,
              backgroundColor: segment.color,
            }}
            title={`${segment.label}: ${Math.round((segment.value / total) * 100)}%`}
          />
        ))}
      </div>
      <div className="flex justify-between text-sm">
        {segments.map((segment) => (
          <div key={segment.id} className="flex items-center gap-2xs">
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: segment.color }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">{segment.label}</span>
            <span className="font-semibold text-foreground">
              {Math.round((segment.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
