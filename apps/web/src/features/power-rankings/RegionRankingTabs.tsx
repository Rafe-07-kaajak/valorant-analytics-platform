import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import type { VctRegion, VctRegionId } from "../../constants/vct";
import { getRegionAccentVar } from "../../constants/regionAccent";

export interface RegionRankingTabsProps {
  regions: readonly VctRegion[];
  selectedRegion: VctRegionId;
  onRegionChange: (region: VctRegionId) => void;
  children: (region: VctRegionId) => ReactNode;
}

/** One tab per VCT region, each with a small identity-color dot (matching `RegionCard`'s existing identity-color convention). */
export function RegionRankingTabs({ regions, selectedRegion, onRegionChange, children }: RegionRankingTabsProps) {
  return (
    <Tabs value={selectedRegion} onValueChange={(value) => onRegionChange(value as VctRegionId)}>
      <TabsList aria-label="Region">
        {regions.map((region) => (
          <TabsTrigger key={region.id} value={region.id} className="flex items-center gap-2xs">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ backgroundColor: getRegionAccentVar(region.id) }}
            />
            {region.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {regions.map((region) => (
        <TabsContent key={region.id} value={region.id} className="pt-md">
          {children(region.id)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
