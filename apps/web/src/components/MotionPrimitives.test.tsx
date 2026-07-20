/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  AnimatedGradient,
  ImageMaskReveal,
  MotionNumber,
  ScrollProgress,
  ScrollReveal,
  StaggerGroup,
  StaggerItem,
  StickyStory,
  TextLineReveal,
  buildRevealVariants,
} from "@repo/ui";
import { mockMatchMedia } from "../test/mockMatchMedia";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("buildRevealVariants — the direction/offset mapping shared by ScrollReveal and StaggerItem (TASK-051)", () => {
  it("maps each direction to the correct hidden offset, always opacity 0", () => {
    expect(buildRevealVariants(24, "up")).toEqual({
      hidden: { opacity: 0, y: 24 },
      visible: { opacity: 1, x: 0, y: 0 },
    });
    expect(buildRevealVariants(24, "down").hidden).toEqual({ opacity: 0, y: -24 });
    expect(buildRevealVariants(24, "left").hidden).toEqual({ opacity: 0, x: 24 });
    expect(buildRevealVariants(24, "right").hidden).toEqual({ opacity: 0, x: -24 });
  });

  it("always resolves to the same fully-visible, untransformed final state", () => {
    for (const direction of ["up", "down", "left", "right"] as const) {
      expect(buildRevealVariants(40, direction).visible).toEqual({ opacity: 1, x: 0, y: 0 });
    }
  });
});

describe("ScrollReveal — TASK-051 extensions (TASK-033 baseline behavior)", () => {
  it("renders its initial hidden state inline before any viewport entry, so nothing flashes visible-then-hidden", () => {
    render(
      <ScrollReveal>
        <p>Reveal me</p>
      </ScrollReveal>,
    );
    const wrapper = screen.getByText("Reveal me").parentElement as HTMLElement;
    expect(wrapper.style.opacity).toBe("0");
  });

  it("renders as a <section> when as=\"section\" is passed", () => {
    render(
      <ScrollReveal as="section">
        <p>Section content</p>
      </ScrollReveal>,
    );
    expect(screen.getByText("Section content").closest("section")).not.toBeNull();
  });

  it("skips the motion wrapper entirely and renders children in their final state when disabled", () => {
    render(
      <ScrollReveal disabled className="reveal-disabled">
        <p>Always visible</p>
      </ScrollReveal>,
    );
    const wrapper = screen.getByText("Always visible").parentElement as HTMLElement;
    expect(wrapper.style.opacity).toBe("");
    expect(wrapper.className).toBe("reveal-disabled");
  });
});

describe("StaggerGroup / StaggerItem — deterministic ordering (TASK-051)", () => {
  it("renders items in exactly the JSX child order supplied, no reordering", () => {
    const { container } = render(
      <StaggerGroup>
        <StaggerItem>First</StaggerItem>
        <StaggerItem>Second</StaggerItem>
        <StaggerItem>Third</StaggerItem>
      </StaggerGroup>,
    );
    const indexOf = (label: string) => container.textContent?.indexOf(label) ?? -1;
    expect(indexOf("First")).toBeGreaterThanOrEqual(0);
    expect(indexOf("First")).toBeLessThan(indexOf("Second"));
    expect(indexOf("Second")).toBeLessThan(indexOf("Third"));
  });

  it("gives every StaggerItem the same hidden initial state ScrollReveal uses", () => {
    render(
      <StaggerGroup>
        <StaggerItem direction="up" distance={24}>
          Item
        </StaggerItem>
      </StaggerGroup>,
    );
    const item = screen.getByText("Item");
    expect(item.style.opacity).toBe("0");
  });
});

describe("TextLineReveal — accessible name without duplication (TASK-051)", () => {
  const text = "Every word animates independently";

  it("exposes the full text as one accessible name on the outer element", () => {
    render(<TextLineReveal text={text} />);
    expect(screen.getByLabelText(text)).toBeInTheDocument();
  });

  it("marks the animated word spans aria-hidden so nothing is announced twice", () => {
    const { container } = render(<TextLineReveal text={text} />);
    const hiddenWrapper = container.querySelector('[aria-hidden="true"]');
    expect(hiddenWrapper).not.toBeNull();
    expect(hiddenWrapper?.textContent).toContain("Every");
  });

  it("splits into exactly one span per word", () => {
    const { container } = render(<TextLineReveal text={text} />);
    const wordCount = text.split(" ").length;
    const spans = container.querySelectorAll('[aria-hidden="true"] > span');
    expect(spans.length).toBe(wordCount);
  });
});

describe("ImageMaskReveal — image is never conditionally mounted (TASK-051)", () => {
  it("always renders children, with the mask as a separate aria-hidden overlay", () => {
    render(
      <ImageMaskReveal>
        <img src="/placeholder.png" alt="A tactical map" />
      </ImageMaskReveal>,
    );
    expect(screen.getByRole("img", { name: "A tactical map" })).toBeInTheDocument();
  });

  it("the mask overlay is aria-hidden and does not block pointer events", () => {
    const { container } = render(
      <ImageMaskReveal maskClassName="test-mask">
        <img src="/placeholder.png" alt="A tactical map" />
      </ImageMaskReveal>,
    );
    const mask = container.querySelector(".test-mask");
    expect(mask).toHaveAttribute("aria-hidden", "true");
    expect(mask?.className).toContain("pointer-events-none");
  });

  it("starts the mask fully covering (no travel-offset transform) before any viewport entry", () => {
    const { container } = render(
      <ImageMaskReveal maskClassName="test-mask">
        <img src="/placeholder.png" alt="cover" />
      </ImageMaskReveal>,
    );
    const mask = container.querySelector(".test-mask") as HTMLElement;
    // Framer collapses an identity 0% translate to `none` rather than writing
    // a literal "translateX(0%)" string — either way, nothing has moved the
    // mask off its covering position yet, which is what "no first-render
    // jump" actually requires.
    expect(mask.style.transform === "none" || mask.style.transform === "").toBe(true);
  });
});

describe("MotionNumber — deterministic formatting, not a random count-up (TASK-051)", () => {
  it("formats percent, integer, and decimal values via Intl.NumberFormat", () => {
    render(<MotionNumber value={0.734} format="percent" decimals={1} />);
    expect(screen.getByLabelText("73.4%")).toBeInTheDocument();

    render(<MotionNumber value={1234} format="integer" />);
    expect(screen.getByLabelText("1,234")).toBeInTheDocument();

    render(<MotionNumber value={1.5} format="decimal" decimals={2} />);
    expect(screen.getByLabelText("1.50")).toBeInTheDocument();
  });

  it("renders the formatted value as real text content, matching its aria-label (no duplication)", () => {
    render(<MotionNumber value={42} format="integer" />);
    const labeled = screen.getByLabelText("42");
    expect(labeled.textContent).toBe("42");
  });

  it("under reduced motion, updates to a new value immediately with no tween", async () => {
    mockMatchMedia((query) => query === "(prefers-reduced-motion: reduce)");
    const { rerender } = render(<MotionNumber value={10} format="integer" />);
    await waitFor(() => expect(screen.getByLabelText("10")).toBeInTheDocument());

    rerender(<MotionNumber value={20} format="integer" />);
    // No `waitFor` needed — the reduced-motion branch writes synchronously
    // inside the effect, which `render`/`rerender` already flush.
    expect(screen.getByLabelText("20")).toBeInTheDocument();
  });

  it("tweens to the new value on a prop change (motion-safe path)", async () => {
    mockMatchMedia(() => false);
    const { rerender } = render(<MotionNumber value={0} format="integer" duration={0.01} />);
    rerender(<MotionNumber value={5} format="integer" duration={0.01} />);

    await waitFor(() => expect(screen.getByLabelText("5")).toBeInTheDocument(), { timeout: 2000 });
  });
});

describe("AnimatedGradient — token-based, decorative (TASK-051)", () => {
  it("applies the requested gradient token and the drift animation class by default", () => {
    const { container } = render(<AnimatedGradient variant="cyanBlue" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("--gradient-cyan-blue");
    expect(el.className).toContain("motion-gradient-drift");
    expect(el).toHaveAttribute("aria-hidden", "true");
  });

  it("omits the drift class when static", () => {
    const { container } = render(<AnimatedGradient variant="mesh" static />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).not.toContain("motion-gradient-drift");
  });
});

describe("ScrollProgress — decorative vs. meaningful (TASK-051)", () => {
  it("is aria-hidden with no progressbar role when no label is given", () => {
    const { container } = render(<ScrollProgress />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).not.toHaveAttribute("role");
  });

  it("exposes role=progressbar with min/max when a label is given", () => {
    render(<ScrollProgress label="Reading progress" />);
    const el = screen.getByRole("progressbar", { name: "Reading progress" });
    expect(el).toHaveAttribute("aria-valuemin", "0");
    expect(el).toHaveAttribute("aria-valuemax", "100");
  });
});

describe("StickyStory — sticky vs. stacked fallback (TASK-051)", () => {
  const steps = [<p key="a">Scene A</p>, <p key="b">Scene B</p>];

  it("renders the sticky two-column layout on a wide, motion-safe viewport", () => {
    mockMatchMedia(() => false);
    const { container } = render(<StickyStory steps={steps} renderSticky={() => <p>Sticky panel</p>} />);
    expect(screen.getByText("Scene A")).toBeInTheDocument();
    expect(screen.getByText("Scene B")).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toContain("Sticky panel");
  });

  it("falls back to a plain stacked list under reduced motion, with no sticky pane", () => {
    mockMatchMedia((query) => query === "(prefers-reduced-motion: reduce)");
    const { container } = render(<StickyStory steps={steps} renderSticky={() => <p>Sticky panel</p>} />);
    expect(screen.getByText("Scene A")).toBeInTheDocument();
    expect(screen.getByText("Scene B")).toBeInTheDocument();
    expect(screen.queryByText("Sticky panel")).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("falls back to stacked below the disabledBelow breakpoint", () => {
    mockMatchMedia((query) => query === "(max-width: 768px)");
    render(<StickyStory steps={steps} renderSticky={() => <p>Sticky panel</p>} />);
    expect(screen.queryByText("Sticky panel")).not.toBeInTheDocument();
    expect(screen.getByText("Scene A")).toBeInTheDocument();
  });
});
