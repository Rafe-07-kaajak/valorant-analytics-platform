"use client";

import { useMemo, useState } from "react";
import type { GameMap } from "@repo/shared";
import { Container, Section } from "@repo/ui";
import type { VctTeamProfile } from "@repo/prediction-engine";
import { FeatureAmbientBackground } from "../../components/effects/FeatureAmbientBackground";
import { MEDIA_ASSETS } from "../../constants/media";
import { AMBIENT_VIDEO_LOOP_CONFIG } from "../../constants/ambientVideoLoopConfig";
import type { VctRegion, VctRegionId, VctTeam, VctTeamId } from "../../constants/vct";
import { PowerRankingsHeader } from "./PowerRankingsHeader";
import { RankingMethodology } from "./RankingMethodology";
import { RankingModeControl } from "./RankingModeControl";
import { GlobalRankingView } from "./GlobalRankingView";
import { RegionalRankingView } from "./RegionalRankingView";
import { TeamDossier } from "./TeamDossier";
import { adaptDisclosureForPowerRankings, buildPowerRankings, groupEntriesByRegion } from "./rankingModel";
import type { PowerRankingEntry } from "./rankingTypes";
import {
  EMPTY_POWER_RANKINGS_URL_STATE,
  withMode,
  withRegion,
  withTeam,
  type PowerRankingsUrlState,
} from "./rankingUrlState";
import { usePowerRankingsUrlState } from "./usePowerRankingsUrlState";

export interface PowerRankingsClientProps {
  regions: readonly VctRegion[];
  teams: readonly VctTeam[];
  profiles: readonly VctTeamProfile[];
  maps: readonly GameMap[];
  /** TASK-031's `VCT_PROFILE_DISCLOSURE` (synthetic fallback) or a real-data disclosure, resolved server-side, adapted here for this page's wording. */
  disclosure: string;
  initialUrlState?: PowerRankingsUrlState;
  /**
   * Real-data-correction task: when the server successfully loaded real
   * per-team state, `page.tsx` passes the already-built real rankings here
   * instead of letting this component build them from `profiles`. Absent
   * (e.g. no local generated dataset) falls back to the original synthetic
   * `buildPowerRankings(teams, profiles)` path, unchanged.
   */
  realRankings?: readonly PowerRankingEntry[];
}

export function PowerRankingsClient({
  regions,
  teams,
  profiles,
  maps,
  disclosure,
  initialUrlState = EMPTY_POWER_RANKINGS_URL_STATE,
  realRankings,
}: PowerRankingsClientProps) {
  const [urlState, setUrlState] = usePowerRankingsUrlState(initialUrlState);

  // Lifted here (not sessionStorage): Global/Regional is a query-param branch
  // inside this one always-mounted client component, not a route change, so
  // plain state already survives mode switching and scrolling for the
  // lifetime of the page.
  const [revealedTeamIds, setRevealedTeamIds] = useState<Set<VctTeamId>>(() => new Set());
  const [dossierTeamId, setDossierTeamId] = useState<VctTeamId | null>(initialUrlState.team);

  const rankings = useMemo(() => realRankings ?? buildPowerRankings(teams, profiles), [realRankings, teams, profiles]);
  const entriesByRegion = useMemo(() => groupEntriesByRegion(rankings), [rankings]);
  const rankingsDisclosure = useMemo(() => adaptDisclosureForPowerRankings(disclosure), [disclosure]);

  const dossierEntry = dossierTeamId ? rankings.find((entry) => entry.team.id === dossierTeamId) ?? null : null;

  const openDossier = (teamId: VctTeamId) => {
    setDossierTeamId(teamId);
    setUrlState((current) => withTeam(current, teamId));
  };

  const closeDossier = () => {
    setDossierTeamId(null);
    setUrlState((current) => withTeam(current, null));
  };

  const reveal = (teamId: VctTeamId) => {
    setRevealedTeamIds((previous) => {
      const next = new Set(previous);
      next.add(teamId);
      return next;
    });
  };

  const dossierContextLabel = (() => {
    if (!dossierEntry) return "";
    return `Global #${dossierEntry.globalRank} · Regional #${dossierEntry.regionalRank}`;
  })();

  return (
    <>
      <FeatureAmbientBackground
        video={MEDIA_ASSETS.powerRankingsAmbientVideo}
        tint="var(--gradient-power-rankings-video-tint)"
        loop={AMBIENT_VIDEO_LOOP_CONFIG.powerRankings}
      />

      <Section className="relative overflow-hidden">
      <Container className="relative flex flex-col gap-lg">
        <PowerRankingsHeader />
        <RankingMethodology disclosure={rankingsDisclosure} />

        <RankingModeControl
          mode={urlState.mode}
          onModeChange={(mode) => setUrlState((current) => withMode(current, mode, regions[0]!.id))}
        >
          {(mode) =>
            mode === "global" ? (
              <GlobalRankingView
                entries={rankings}
                revealedTeamIds={revealedTeamIds}
                onReveal={reveal}
                onOpenDossier={openDossier}
              />
            ) : (
              <RegionalRankingView
                regions={regions}
                entriesByRegion={entriesByRegion}
                selectedRegion={urlState.region ?? regions[0]!.id}
                onRegionChange={(region: VctRegionId) => setUrlState((current) => withRegion(current, region))}
                onOpenDossier={openDossier}
              />
            )
          }
        </RankingModeControl>

        <TeamDossier
          entry={dossierEntry}
          open={Boolean(dossierEntry)}
          onOpenChange={(open) => {
            if (!open) closeDossier();
          }}
          contextLabel={dossierContextLabel}
          maps={maps}
        />
      </Container>
      </Section>
    </>
  );
}
