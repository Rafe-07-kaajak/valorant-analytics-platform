/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { usePointerGlow } from "./usePointerGlow";

function fakeEvent<T extends HTMLElement>(
  target: T,
  overrides: Partial<{ pointerType: string; clientX: number; clientY: number }> = {},
): ReactPointerEvent<T> {
  return {
    pointerType: "mouse",
    clientX: 0,
    clientY: 0,
    currentTarget: target,
    ...overrides,
  } as unknown as ReactPointerEvent<T>;
}

describe("usePointerGlow", () => {
  it("does nothing on pointer-move before a pointer-enter has cached a rect", () => {
    const { result } = renderHook(() => usePointerGlow<HTMLDivElement>());
    const div = document.createElement("div");

    result.current.onPointerMove(fakeEvent(div, { clientX: 50, clientY: 60 }));

    expect(div.style.getPropertyValue("--spotlight-x")).toBe("");
    expect(div.style.getPropertyValue("--spotlight-y")).toBe("");
  });

  it("writes --spotlight-x/--spotlight-y relative to the cached rect after pointer-enter", () => {
    const { result } = renderHook(() => usePointerGlow<HTMLDivElement>());
    const div = document.createElement("div");
    document.body.appendChild(div);
    // jsdom's getBoundingClientRect defaults to all-zero, which is fine —
    // this test only needs to assert the offset math, not real layout.

    result.current.onPointerEnter(fakeEvent(div));
    result.current.onPointerMove(fakeEvent(div, { clientX: 42, clientY: 17 }));

    expect(div.style.getPropertyValue("--spotlight-x")).toBe("42px");
    expect(div.style.getPropertyValue("--spotlight-y")).toBe("17px");

    document.body.removeChild(div);
  });

  it("ignores touch pointer events entirely", () => {
    const { result } = renderHook(() => usePointerGlow<HTMLDivElement>());
    const div = document.createElement("div");

    result.current.onPointerEnter(fakeEvent(div, { pointerType: "touch" }));
    result.current.onPointerMove(fakeEvent(div, { pointerType: "touch", clientX: 5, clientY: 5 }));

    expect(div.style.getPropertyValue("--spotlight-x")).toBe("");
  });

  it("stops updating after pointer-leave until the next pointer-enter", () => {
    const { result } = renderHook(() => usePointerGlow<HTMLDivElement>());
    const div = document.createElement("div");

    result.current.onPointerEnter(fakeEvent(div));
    result.current.onPointerMove(fakeEvent(div, { clientX: 10, clientY: 10 }));
    expect(div.style.getPropertyValue("--spotlight-x")).toBe("10px");

    result.current.onPointerLeave();
    result.current.onPointerMove(fakeEvent(div, { clientX: 99, clientY: 99 }));

    // No new write happened because the cached rect was cleared on leave.
    expect(div.style.getPropertyValue("--spotlight-x")).toBe("10px");
  });
});
