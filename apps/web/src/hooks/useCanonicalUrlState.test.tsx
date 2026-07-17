/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_CANONICAL_URL_STATE, withTeamA, withMaps, type CanonicalFieldKey } from "../lib/urlState";
import { useCanonicalUrlState } from "./useCanonicalUrlState";

const replace = vi.fn();
let mockSearch = "";

// Mirrors what the real App Router does: a `replace` call is reflected in
// the next `useSearchParams()` read, not just recorded as a call.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: (url: string, options?: unknown) => {
      replace(url, options);
      const queryIndex = url.indexOf("?");
      mockSearch = queryIndex === -1 ? "" : url.slice(queryIndex + 1);
    },
  }),
  usePathname: () => "/team-comparison",
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

const VALID_MAP_IDS = new Set(["ascent", "haven", "bind"]);
const TC_FIELDS: readonly CanonicalFieldKey[] = ["regionA", "teamA", "regionB", "teamB"];
const ME_FIELDS: readonly CanonicalFieldKey[] = ["regionA", "teamA", "regionB", "teamB", "maps"];

afterEach(() => {
  cleanup();
  replace.mockClear();
  mockSearch = "";
});

describe("useCanonicalUrlState", () => {
  it("does not call router.replace on mount, even when initial state came from a URL", () => {
    mockSearch = "teamA=paper-rex";
    renderHook(() => useCanonicalUrlState({ ...EMPTY_CANONICAL_URL_STATE, teamA: "paper-rex", regionA: "pacific" }, TC_FIELDS, VALID_MAP_IDS));
    expect(replace).not.toHaveBeenCalled();
  });

  it("calls router.replace exactly once after a single interactive state change", () => {
    const { result } = renderHook(() => useCanonicalUrlState(EMPTY_CANONICAL_URL_STATE, TC_FIELDS, VALID_MAP_IDS));

    act(() => {
      result.current[1]((prev) => withTeamA(prev, "paper-rex"));
    });

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/team-comparison?regionA=pacific&teamA=paper-rex", { scroll: false });
  });

  it("does not call router.replace again when state is set to an equivalent value", () => {
    const { result } = renderHook(() => useCanonicalUrlState(EMPTY_CANONICAL_URL_STATE, TC_FIELDS, VALID_MAP_IDS));

    act(() => {
      result.current[1]((prev) => withTeamA(prev, "paper-rex"));
    });
    expect(replace).toHaveBeenCalledTimes(1);

    act(() => {
      result.current[1]((prev) => ({ ...prev }));
    });
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("navigates to a bare pathname (no query) when state returns to empty", () => {
    const { result } = renderHook(() => useCanonicalUrlState({ ...EMPTY_CANONICAL_URL_STATE, teamA: "paper-rex", regionA: "pacific" }, TC_FIELDS, VALID_MAP_IDS));

    act(() => {
      result.current[1](EMPTY_CANONICAL_URL_STATE);
    });

    expect(replace).toHaveBeenCalledWith("/team-comparison", { scroll: false });
  });

  it("only writes fields it owns, dropping maps for a Team Comparison-scoped hook", () => {
    const { result } = renderHook(() =>
      useCanonicalUrlState({ ...EMPTY_CANONICAL_URL_STATE, maps: ["ascent"] }, TC_FIELDS, VALID_MAP_IDS),
    );

    act(() => {
      result.current[1]((prev) => withTeamA(prev, "paper-rex"));
    });

    expect(replace).toHaveBeenCalledWith("/team-comparison?regionA=pacific&teamA=paper-rex", { scroll: false });
  });

  it("supports a maps-owning field set (Map Matchup Explorer)", () => {
    const { result } = renderHook(() => useCanonicalUrlState(EMPTY_CANONICAL_URL_STATE, ME_FIELDS, VALID_MAP_IDS));

    act(() => {
      result.current[1]((prev) => withMaps(prev, ["ascent", "haven"], VALID_MAP_IDS));
    });

    expect(replace).toHaveBeenCalledWith("/team-comparison?maps=ascent%2Chaven", { scroll: false });
  });

  it("re-derives state when the URL changes externally (simulated back/forward)", () => {
    mockSearch = "teamA=paper-rex&regionA=pacific";
    const { result, rerender } = renderHook(
      ({ search }) => {
        mockSearch = search;
        return useCanonicalUrlState({ ...EMPTY_CANONICAL_URL_STATE, teamA: "paper-rex", regionA: "pacific" }, TC_FIELDS, VALID_MAP_IDS);
      },
      { initialProps: { search: "teamA=paper-rex&regionA=pacific" } },
    );

    expect(result.current[0].teamA).toBe("paper-rex");

    rerender({ search: "" });
    expect(result.current[0].teamA).toBeNull();
  });

  it("does not call router.replace as a side effect of an external URL change", () => {
    const { rerender } = renderHook(
      ({ search }) => {
        mockSearch = search;
        return useCanonicalUrlState(EMPTY_CANONICAL_URL_STATE, TC_FIELDS, VALID_MAP_IDS);
      },
      { initialProps: { search: "" } },
    );

    rerender({ search: "teamA=paper-rex&regionA=pacific" });
    expect(replace).not.toHaveBeenCalled();
  });
});
