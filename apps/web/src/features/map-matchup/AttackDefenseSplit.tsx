import type { ReactNode } from "react";
import { Crosshair, ShieldHalf } from "lucide-react";
import { Card, SplitBar, cn } from "@repo/ui";
import { AdvantageBadge } from "../team-comparison/AdvantageBadge";
import type { SupportingMetric } from "../../lib/mapMatchup";

export interface AttackDefenseSplitProps {
  teamAName: string;
  teamBName: string;
  attack: SupportingMetric | undefined;
  defense: SupportingMetric | undefined;
}

/**
 * TASK-058 — elevates the two side-strength fields (`attackStrength`,
 * `defenseStrength`) `buildSupportingMetrics` already computes out of the
 * flat nine-metric list, giving Map Explorer's signature attack=cyan /
 * defense=acid-green language a dedicated, higher-emphasis home. No new
 * data: both rows reuse the same `SupportingMetric` entries the generic
 * metric grid below also draws from. Color is never the only signal — each
 * row keeps its icon+text label plus the same team-name-bearing
 * `AdvantageBadge` and labeled `SplitBar` used everywhere else in this
 * feature.
 */
export function AttackDefenseSplit({ teamAName, teamBName, attack, defense }: AttackDefenseSplitProps) {
  if (!attack || !defense) return null;

  return (
    <Card variant="metric" className="flex flex-col gap-md">
      <span className="text-sm font-medium text-foreground">Attack vs. defense strength</span>

      <SideRow
        icon={<Crosshair className="size-4" aria-hidden="true" />}
        label="Attack strength"
        accentClassName="text-accent-cyan"
        metric={attack}
        teamAName={teamAName}
        teamBName={teamBName}
      />
      <SideRow
        icon={<ShieldHalf className="size-4" aria-hidden="true" />}
        label="Defense strength"
        accentClassName="text-accent-lime"
        metric={defense}
        teamAName={teamAName}
        teamBName={teamBName}
      />
    </Card>
  );
}

function SideRow({
  icon,
  label,
  accentClassName,
  metric,
  teamAName,
  teamBName,
}: {
  icon: ReactNode;
  label: string;
  accentClassName: string;
  metric: SupportingMetric;
  teamAName: string;
  teamBName: string;
}) {
  return (
    <div className="flex flex-col gap-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2xs">
        <span className={cn("flex items-center gap-2xs text-sm font-medium", accentClassName)}>
          {icon}
          <span className="text-foreground">{label}</span>
        </span>
        <AdvantageBadge advantage={metric.advantage} tier={metric.tier} teamAName={teamAName} teamBName={teamBName} />
      </div>
      <SplitBar
        segments={[
          { id: "a", label: teamAName, value: metric.valueA, color: "var(--team-a)" },
          { id: "b", label: teamBName, value: metric.valueB, color: "var(--team-b)" },
        ]}
      />
    </div>
  );
}
