import { cn } from "../../lib/cn";

export interface RadarAxis {
  key: string;
  label: string;
}

export interface RadarSeries {
  id: string;
  label: string;
  color: string;
  values: Record<string, number>;
}

export interface RadarChartProps {
  axes: RadarAxis[];
  series: [RadarSeries, RadarSeries];
  max?: number;
  size?: number;
  className?: string;
}

const RING_STEPS = [0.25, 0.5, 0.75, 1];

function pointAt(index: number, total: number, radiusFraction: number, radius: number, cx: number, cy: number) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const r = radiusFraction * radius;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

export function RadarChart({ axes, series, max = 100, size = 320, className }: RadarChartProps) {
  const padding = 70;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - padding;
  const total = axes.length;

  const polygonPoints = (values: Record<string, number>) =>
    axes
      .map((axis, index) => {
        const fraction = Math.min(1, Math.max(0, (values[axis.key] ?? 0) / max));
        const { x, y } = pointAt(index, total, fraction, radius, cx, cy);
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <div className={cn("flex flex-col items-center gap-md", className)}>
      <svg
        role="img"
        aria-label={`Team DNA comparison between ${series[0].label} and ${series[1].label}`}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        {RING_STEPS.map((step) => (
          <polygon
            key={step}
            points={axes
              .map((_, index) => {
                const { x, y } = pointAt(index, total, step, radius, cx, cy);
                return `${x},${y}`;
              })
              .join(" ")}
            fill="none"
            stroke="var(--surface-border)"
            strokeWidth={1}
          />
        ))}

        {axes.map((axis, index) => {
          const { x, y } = pointAt(index, total, 1, radius, cx, cy);
          return (
            <line
              key={axis.key}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="var(--surface-border)"
              strokeWidth={1}
            />
          );
        })}

        {series.map((s) => (
          <polygon
            key={s.id}
            points={polygonPoints(s.values)}
            fill={s.color}
            fillOpacity={0.1}
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ))}

        {series.map((s) =>
          axes.map((axis, index) => {
            const fraction = Math.min(1, Math.max(0, (s.values[axis.key] ?? 0) / max));
            const { x, y } = pointAt(index, total, fraction, radius, cx, cy);
            return (
              <circle key={`${s.id}-${axis.key}`} cx={x} cy={y} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2}>
                <title>
                  {s.label} — {axis.label}: {Math.round(s.values[axis.key] ?? 0)}
                </title>
              </circle>
            );
          }),
        )}

        {axes.map((axis, index) => {
          const { x, y } = pointAt(index, total, 1.15, radius, cx, cy);
          const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
          const anchor = Math.cos(angle) > 0.3 ? "start" : Math.cos(angle) < -0.3 ? "end" : "middle";
          return (
            <text
              key={axis.key}
              x={x}
              y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={11}
              fill="var(--muted-foreground)"
            >
              {axis.label}
            </text>
          );
        })}
      </svg>

      <div className="flex items-center gap-lg">
        {series.map((s) => (
          <div key={s.id} className="flex items-center gap-2xs">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden="true"
            />
            <span className="text-sm text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
