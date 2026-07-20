/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import {
  useMediaQuery,
  usePointerCapability,
  usePrefersReducedMotion,
  computeParallaxRange,
  computeActiveStepIndex,
} from "@repo/ui";
import { mockMatchMedia } from "../test/mockMatchMedia";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Probe({ query }: { query: string }) {
  const matches = useMediaQuery(query);
  return <span data-testid="probe">{String(matches)}</span>;
}

describe("useMediaQuery — TASK-051", () => {
  it("reflects the query's initial matchMedia value after mount", () => {
    mockMatchMedia((query) => query === "(min-width: 999px)");
    render(<Probe query="(min-width: 999px)" />);
    expect(screen.getByTestId("probe")).toHaveTextContent("true");
  });

  it("updates when the media query change event fires", () => {
    const { fireChange } = mockMatchMedia(() => false);
    render(<Probe query="(prefers-reduced-motion: reduce)" />);
    expect(screen.getByTestId("probe")).toHaveTextContent("false");

    act(() => fireChange("(prefers-reduced-motion: reduce)", true));
    expect(screen.getByTestId("probe")).toHaveTextContent("true");
  });

  it("cleans up its change listener on unmount", () => {
    const { listenerCount } = mockMatchMedia(() => false);
    const { unmount } = render(<Probe query="(hover: hover)" />);
    expect(listenerCount("(hover: hover)")).toBe(1);

    unmount();
    expect(listenerCount("(hover: hover)")).toBe(0);
  });
});

describe("usePrefersReducedMotion — TASK-051", () => {
  it("returns false when the OS has no reduced-motion preference", () => {
    mockMatchMedia(() => false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true when prefers-reduced-motion: reduce matches", () => {
    mockMatchMedia((query) => query === "(prefers-reduced-motion: reduce)");
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });
});

describe("usePointerCapability — TASK-051", () => {
  it("reports a fine, hover-capable pointer as not coarse", () => {
    mockMatchMedia((query) => query === "(pointer: fine)" || query === "(hover: hover)");
    const { result } = renderHook(() => usePointerCapability());
    expect(result.current).toEqual({ isFinePointer: true, hasHover: true, isCoarsePointer: false });
  });

  it("reports a touch device (no fine pointer, no hover) as coarse", () => {
    mockMatchMedia(() => false);
    const { result } = renderHook(() => usePointerCapability());
    expect(result.current).toEqual({ isFinePointer: false, hasHover: false, isCoarsePointer: true });
  });

  it("treats a fine pointer with no hover (some styluses/hybrids) as coarse", () => {
    mockMatchMedia((query) => query === "(pointer: fine)");
    const { result } = renderHook(() => usePointerCapability());
    expect(result.current.isCoarsePointer).toBe(true);
  });
});

describe("computeParallaxRange — ParallaxLayer's pure travel calculation (TASK-051)", () => {
  it("collapses to [0, 0] when disabled, regardless of speed", () => {
    expect(computeParallaxRange(0.8, true)).toEqual([0, 0]);
    expect(computeParallaxRange(-0.8, true)).toEqual([0, 0]);
  });

  it("scales symmetrically with speed when enabled", () => {
    expect(computeParallaxRange(0.5, false)).toEqual([-32, 32]);
    expect(computeParallaxRange(1, false)).toEqual([-64, 64]);
  });

  it("reverses the output order for negative speed relative to positive speed", () => {
    const positive = computeParallaxRange(0.5, false);
    const negative = computeParallaxRange(-0.5, false);
    expect(negative).toEqual([positive[1], positive[0]]);
  });
});

describe("computeActiveStepIndex — StickyStory's pure step calculation (TASK-051)", () => {
  it("maps progress evenly across steps", () => {
    expect(computeActiveStepIndex(0, 3)).toBe(0);
    expect(computeActiveStepIndex(0.34, 3)).toBe(1);
    expect(computeActiveStepIndex(0.67, 3)).toBe(2);
  });

  it("clamps progress below 0 or at/above 1 into range", () => {
    expect(computeActiveStepIndex(-0.5, 3)).toBe(0);
    expect(computeActiveStepIndex(1, 3)).toBe(2);
    expect(computeActiveStepIndex(1.2, 3)).toBe(2);
  });

  it("never returns a negative index for zero steps", () => {
    expect(computeActiveStepIndex(0.5, 0)).toBe(0);
  });
});
