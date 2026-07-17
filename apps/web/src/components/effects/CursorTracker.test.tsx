/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { CursorTracker } from "./CursorTracker";
import { cursorPosition } from "../../lib/cursorPosition";

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty("--cursor-x");
  document.documentElement.style.removeProperty("--cursor-y");
  delete document.documentElement.dataset.cursorActive;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockMatchMedia(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches,
    media: "",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList);
}

describe("CursorTracker", () => {
  beforeEach(() => {
    // Run rAF callbacks synchronously so CSS-var writes are observable
    // immediately, without depending on real animation-frame timing.
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  it("mounts safely and renders nothing", () => {
    mockMatchMedia(true);
    const { container } = render(<CursorTracker />);
    expect(container).toBeEmptyDOMElement();
  });

  it("attaches exactly one global pointermove listener on fine-pointer devices", () => {
    mockMatchMedia(true);
    const addSpy = vi.spyOn(window, "addEventListener");
    render(<CursorTracker />);

    const pointermoveCalls = addSpy.mock.calls.filter(([type]) => type === "pointermove");
    expect(pointermoveCalls).toHaveLength(1);
  });

  it("attaches no listener at all on coarse/no-hover devices", () => {
    mockMatchMedia(false);
    const addSpy = vi.spyOn(window, "addEventListener");
    render(<CursorTracker />);

    const pointermoveCalls = addSpy.mock.calls.filter(([type]) => type === "pointermove");
    expect(pointermoveCalls).toHaveLength(0);
  });

  it("removes its listeners on unmount", () => {
    mockMatchMedia(true);
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<CursorTracker />);
    unmount();

    const pointermoveCalls = removeSpy.mock.calls.filter(([type]) => type === "pointermove");
    expect(pointermoveCalls).toHaveLength(1);
  });

  it("writes cursor CSS custom properties and updates the shared cursorPosition store on pointermove", () => {
    mockMatchMedia(true);
    render(<CursorTracker />);

    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 120, clientY: 340, pointerType: "mouse" }),
    );

    expect(document.documentElement.style.getPropertyValue("--cursor-x")).toBe("120px");
    expect(document.documentElement.style.getPropertyValue("--cursor-y")).toBe("340px");
    expect(document.documentElement.dataset.cursorActive).toBe("true");
    expect(cursorPosition.x).toBe(120);
    expect(cursorPosition.y).toBe(340);
    expect(cursorPosition.active).toBe(true);
  });

  it("ignores touch pointer events", () => {
    mockMatchMedia(true);
    render(<CursorTracker />);

    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 99, clientY: 99, pointerType: "touch" }),
    );

    expect(document.documentElement.style.getPropertyValue("--cursor-x")).toBe("");
    expect(cursorPosition.active).toBe(false);
  });

  it("resets active state on pointerleave (mouseleave of <html>)", () => {
    mockMatchMedia(true);
    render(<CursorTracker />);

    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 10, clientY: 10, pointerType: "mouse" }));
    expect(document.documentElement.dataset.cursorActive).toBe("true");

    document.documentElement.dispatchEvent(new MouseEvent("mouseleave"));
    expect(document.documentElement.dataset.cursorActive).toBe("false");
    expect(cursorPosition.active).toBe(false);
  });

  it("clears data-cursor-active on unmount", () => {
    mockMatchMedia(true);
    const { unmount } = render(<CursorTracker />);
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 10, clientY: 10, pointerType: "mouse" }));
    expect(document.documentElement.dataset.cursorActive).toBe("true");

    unmount();
    expect(document.documentElement.dataset.cursorActive).toBeUndefined();
  });
});
