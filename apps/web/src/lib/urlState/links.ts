import { getTeamById } from "../../constants/vct";
import { serializeUrlState } from "./serialize";
import type { AnalyticsFeature, CanonicalFieldKey, CanonicalUrlState } from "./types";

export const FEATURE_ROUTES: Record<AnalyticsFeature, string> = {
  "prediction-studio": "/prediction-studio",
  "team-comparison": "/team-comparison",
  "map-matchup": "/map-matchup",
};

const FEATURE_DESTINATION_NAMES: Record<AnalyticsFeature, string> = {
  "prediction-studio": "Prediction Studio",
  "team-comparison": "Team Comparison Lab",
  "map-matchup": "Map Matchup Explorer",
};

/** Each route's complete canonical vocabulary — the fields it reads on init, writes on selection change, and accepts from an incoming cross-feature link. Team Comparison Lab has no map or format concept; Map Matchup Explorer has no format concept. */
export const FEATURE_FIELDS: Record<AnalyticsFeature, readonly CanonicalFieldKey[]> = {
  "prediction-studio": ["regionA", "teamA", "regionB", "teamB", "maps", "format"],
  "team-comparison": ["regionA", "teamA", "regionB", "teamB"],
  "map-matchup": ["regionA", "teamA", "regionB", "teamB", "maps"],
};

/** The label a link uses depends on both where it starts and where it goes, per TASK-039 requirement 7 (e.g. Prediction Studio → Map Matchup Explorer reads "Explore Maps", but Team Comparison Lab → Map Matchup Explorer reads "Explore Map Matchup"). */
const LINK_LABELS: Record<AnalyticsFeature, Partial<Record<AnalyticsFeature, string>>> = {
  "prediction-studio": {
    "team-comparison": "Compare Teams",
    "map-matchup": "Explore Maps",
  },
  "team-comparison": {
    "prediction-studio": "Open in Prediction Studio",
    "map-matchup": "Explore Map Matchup",
  },
  "map-matchup": {
    "prediction-studio": "Open in Prediction Studio",
    "team-comparison": "Compare Teams",
  },
};

export function buildFeatureHref(feature: AnalyticsFeature, state: CanonicalUrlState): string {
  const query = serializeUrlState(state, FEATURE_FIELDS[feature]);
  return query ? `${FEATURE_ROUTES[feature]}?${query}` : FEATURE_ROUTES[feature];
}

export interface FeatureLinkDescriptor {
  feature: AnalyticsFeature;
  label: string;
  href: string;
  ariaLabel: string;
}

/**
 * Generates the cross-feature navigation links for the current feature —
 * every route except the one the user is already on, and only once both
 * teams are validly selected. Empty (`[]`) whenever `teamA`/`teamB` aren't
 * both set, which is what makes `AnalyticsContextLinks` render nothing until
 * both teams are selected.
 */
export function generateFeatureLinks(currentFeature: AnalyticsFeature, state: CanonicalUrlState): FeatureLinkDescriptor[] {
  if (!state.teamA || !state.teamB) return [];

  const teamAName = getTeamById(state.teamA)?.name ?? "Team A";
  const teamBName = getTeamById(state.teamB)?.name ?? "Team B";

  return (Object.keys(FEATURE_ROUTES) as AnalyticsFeature[])
    .filter((feature) => feature !== currentFeature)
    .map((feature) => {
      const label = LINK_LABELS[currentFeature][feature]!;
      return {
        feature,
        label,
        href: buildFeatureHref(feature, state),
        ariaLabel: `${label}: ${teamAName} vs ${teamBName} in ${FEATURE_DESTINATION_NAMES[feature]}`,
      };
    });
}
