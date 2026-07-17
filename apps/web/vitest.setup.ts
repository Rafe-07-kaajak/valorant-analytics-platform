import { createElement } from "react";
import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// jsdom has no PointerEvent constructor (as of the version this repo pins),
// which breaks both `new PointerEvent(...)` in tests and
// @testing-library/react's fireEvent.pointer*() helpers — both TASK-034's
// cursor-tracking tests need it. A MouseEvent subclass carrying pointerType
// is a faithful enough stand-in for jsdom component tests.
if (typeof window !== "undefined" && typeof window.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    public pointerType: string;
    public pointerId: number;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerType = params.pointerType ?? "mouse";
      this.pointerId = params.pointerId ?? 1;
    }
  }
  // @ts-expect-error — intentionally patching the global for jsdom's benefit.
  window.PointerEvent = PointerEventPolyfill;
}

// jsdom doesn't implement these Element APIs; Radix's Tabs (roving-tabindex
// keyboard navigation) and other primitives call them internally and throw
// or silently no-op without them, which otherwise breaks fireEvent.click/
// keyDown-driven interaction in component tests.
if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

// next/image depends on the Next.js runtime (loader, srcset generation) that
// isn't present when a component test runs directly under Vitest/jsdom.
// Rendering a plain <img> with the same props is a faithful enough stand-in
// for component-level assertions (alt text, src, selected/disabled state).
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const imgProps = { ...props };
    delete imgProps.fill;
    delete imgProps.sizes;
    return createElement("img", imgProps);
  },
}));
