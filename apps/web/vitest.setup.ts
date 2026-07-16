import { createElement } from "react";
import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

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
