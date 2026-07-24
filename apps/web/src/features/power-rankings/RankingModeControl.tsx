import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import type { RankingMode } from "./rankingTypes";

export interface RankingModeControlProps {
  mode: RankingMode;
  onModeChange: (mode: RankingMode) => void;
  children: (mode: RankingMode) => ReactNode;
}

const MODES: readonly RankingMode[] = ["global", "regional"];

/**
 * Global/Regional switch, structured like `RegionRankingTabs`'s render-prop
 * pattern: each mode gets a real `TabsContent`, so Radix's auto-generated
 * `aria-controls` on each `TabsTrigger` always resolves to an actual element
 * (an axe `aria-valid-attr-value` violation otherwise) — the mode-specific
 * views (`GlobalRankingView`/`RegionalRankingView`) are structurally
 * different, so the caller decides what to render per mode via `children`.
 */
export function RankingModeControl({ mode, onModeChange, children }: RankingModeControlProps) {
  return (
    <Tabs value={mode} onValueChange={(value) => onModeChange(value as RankingMode)}>
      <TabsList aria-label="Ranking mode">
        <TabsTrigger value="global">Global</TabsTrigger>
        <TabsTrigger value="regional">Regional</TabsTrigger>
      </TabsList>

      {MODES.map((candidateMode) => (
        <TabsContent key={candidateMode} value={candidateMode} className="pt-md">
          {children(candidateMode)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
