import { describe, expect, it } from "vitest";
import { buildTeamLifecycleTimeline, detectRenames, detectSharedDisplayNames } from "./teamLifecycle";
import type { TeamNameObservation } from "./teamLifecycle";

describe("buildTeamLifecycleTimeline / detectRenames", () => {
  it("builds a chronological name-history timeline for one VLR team ID with a single stable name", () => {
    const observations: TeamNameObservation[] = [
      { vlrTeamId: "100", displayName: "Fnatic", observedAt: "2025-01-01T00:00:00Z", sourceUrl: "https://www.vlr.gg/team/100/fnatic" },
      { vlrTeamId: "100", displayName: "Fnatic", observedAt: "2025-06-01T00:00:00Z", sourceUrl: "https://www.vlr.gg/team/100/fnatic" },
    ];
    const timeline = buildTeamLifecycleTimeline(observations);
    expect(timeline.get("100")).toHaveLength(1);
    expect(detectRenames(timeline)).toHaveLength(0);
  });

  it("detects a same-VLR-ID rename as two distinct name periods", () => {
    const observations: TeamNameObservation[] = [
      { vlrTeamId: "100", displayName: "Old Org Name", observedAt: "2025-01-01T00:00:00Z", sourceUrl: "u1" },
      { vlrTeamId: "100", displayName: "New Org Name", observedAt: "2026-01-01T00:00:00Z", sourceUrl: "u2" },
    ];
    const timeline = buildTeamLifecycleTimeline(observations);
    const periods = timeline.get("100")!;
    expect(periods).toHaveLength(2);
    expect(periods[0]!.displayName).toBe("Old Org Name");
    expect(periods[1]!.displayName).toBe("New Org Name");

    const renames = detectRenames(timeline);
    expect(renames).toEqual([{ vlrTeamId: "100", names: ["Old Org Name", "New Org Name"] }]);
  });
});

describe("detectSharedDisplayNames", () => {
  it("never merges two distinct VLR IDs sharing the same display name — only reports it", () => {
    const observations: TeamNameObservation[] = [
      { vlrTeamId: "100", displayName: "Team Secret", observedAt: "t1", sourceUrl: "u1" },
      { vlrTeamId: "200", displayName: "Team Secret", observedAt: "t2", sourceUrl: "u2" },
    ];
    const shared = detectSharedDisplayNames(observations);
    expect([...(shared.get("Team Secret") ?? [])].sort()).toEqual(["100", "200"]);
  });

  it("returns nothing when every display name maps to exactly one VLR ID", () => {
    const observations: TeamNameObservation[] = [{ vlrTeamId: "100", displayName: "Fnatic", observedAt: "t1", sourceUrl: "u1" }];
    expect(detectSharedDisplayNames(observations).size).toBe(0);
  });
});
