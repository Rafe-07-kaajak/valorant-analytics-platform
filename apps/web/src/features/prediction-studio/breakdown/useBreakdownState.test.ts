/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBreakdownState } from "./useBreakdownState";

describe("useBreakdownState", () => {
  it("starts with nothing active", () => {
    const { result } = renderHook(() => useBreakdownState());
    expect(result.current.activeDimensionKey).toBeNull();
    expect(result.current.activeStageId).toBeNull();
  });

  it("hover sets the active dimension immediately", () => {
    const { result } = renderHook(() => useBreakdownState());
    act(() => result.current.hoverDimension("aggression"));
    expect(result.current.activeDimensionKey).toBe("aggression");
    expect(result.current.selectedDimensionKey).toBeNull();
  });

  it("mouseleave (hover null) does not erase a keyboard/click selection", () => {
    const { result } = renderHook(() => useBreakdownState());
    act(() => result.current.selectDimension("tempo"));
    act(() => result.current.hoverDimension("aggression"));
    expect(result.current.activeDimensionKey).toBe("aggression");

    act(() => result.current.hoverDimension(null));
    expect(result.current.activeDimensionKey).toBe("tempo");
    expect(result.current.selectedDimensionKey).toBe("tempo");
  });

  it("selection persists as the active id once hover clears, even with no prior hover", () => {
    const { result } = renderHook(() => useBreakdownState());
    act(() => result.current.selectDimension("mapControl"));
    expect(result.current.activeDimensionKey).toBe("mapControl");
  });

  it("selecting a new dimension overrides the previous selection", () => {
    const { result } = renderHook(() => useBreakdownState());
    act(() => result.current.selectDimension("aggression"));
    act(() => result.current.selectDimension("tempo"));
    expect(result.current.selectedDimensionKey).toBe("tempo");
  });

  it("tracks pipeline stage hover/selection independently of dimension state", () => {
    const { result } = renderHook(() => useBreakdownState());
    act(() => result.current.selectDimension("aggression"));
    act(() => result.current.selectStage("validation"));
    expect(result.current.selectedDimensionKey).toBe("aggression");
    expect(result.current.selectedStageId).toBe("validation");
  });

  it("clear resets both dimension and stage state", () => {
    const { result } = renderHook(() => useBreakdownState());
    act(() => result.current.selectDimension("aggression"));
    act(() => result.current.selectStage("validation"));
    act(() => result.current.clear());
    expect(result.current.activeDimensionKey).toBeNull();
    expect(result.current.activeStageId).toBeNull();
    expect(result.current.selectedDimensionKey).toBeNull();
    expect(result.current.selectedStageId).toBeNull();
  });
});
