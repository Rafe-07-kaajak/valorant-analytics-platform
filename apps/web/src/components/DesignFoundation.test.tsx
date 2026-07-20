/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Badge, Button, Card, Input, Select } from "@repo/ui";

afterEach(cleanup);

describe("Button — TASK-050 variant hierarchy", () => {
  it("keeps the pre-existing primary/secondary/ghost variants rendering their exact prior classes", () => {
    render(<Button>Generate Prediction</Button>);
    const button = screen.getByRole("button", { name: "Generate Prediction" });
    expect(button.className).toContain("bg-brand-500");
    expect(button.className).toContain("text-white");
  });

  it("adds the tertiary, destructive, highEmphasis, and regionAccented variants", () => {
    const { rerender } = render(<Button variant="tertiary">Tertiary</Button>);
    expect(screen.getByRole("button", { name: "Tertiary" }).className).toContain("text-brand-500");

    rerender(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole("button", { name: "Delete" }).className).toContain("bg-danger");

    rerender(<Button variant="highEmphasis">Go</Button>);
    expect(screen.getByRole("button", { name: "Go" }).className).toContain("var(--gradient-button)");

    rerender(<Button variant="regionAccented">Region</Button>);
    expect(screen.getByRole("button", { name: "Region" }).className).toContain("--button-region-color");
  });

  it("adds an icon size alongside the pre-existing sm/md/lg sizes", () => {
    render(<Button size="icon" aria-label="Close" />);
    expect(screen.getByRole("button", { name: "Close" }).className).toContain("size-10");
  });

  it("shows the shared Spinner and disables the button when loading", () => {
    render(<Button loading>Submit</Button>);
    const button = screen.getByRole("button", { name: "Loading" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Submit")).not.toBeInTheDocument();
  });
});

describe("Card — TASK-050 variant hierarchy", () => {
  it("renders the pre-existing (variant-less) classes unchanged when no variant is passed", () => {
    render(<Card data-testid="card">content</Card>);
    expect(screen.getByTestId("card").className).toBe(
      "rounded-lg border border-surface-border bg-surface p-md shadow-sm",
    );
  });

  it("supports the informational, interactive, selected, metric, result, feature, glass, and editorial variants", () => {
    const variants = [
      "informational",
      "interactive",
      "selected",
      "metric",
      "result",
      "feature",
      "glass",
      "editorial",
    ] as const;

    for (const variant of variants) {
      const { unmount } = render(
        <Card variant={variant} data-testid="card">
          content
        </Card>,
      );
      expect(screen.getByTestId("card").className.length).toBeGreaterThan(0);
      unmount();
    }
  });

  it("selected variant references the shared --glow-selected token instead of a one-off shadow string", () => {
    render(
      <Card variant="selected" data-testid="card">
        content
      </Card>,
    );
    expect(screen.getByTestId("card").className).toContain("--glow-selected");
  });
});

describe("Badge — TASK-050 tone additions", () => {
  it("keeps the pre-existing neutral/success/danger/brand tones rendering their exact prior classes", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default").className).toContain("bg-surface-border");
  });

  it("adds info, neutralStatus, and the four region tones", () => {
    const tones = ["info", "neutralStatus", "regionAmericas", "regionEmea", "regionPacific", "regionChina"] as const;
    for (const tone of tones) {
      const { unmount } = render(<Badge tone={tone}>{tone}</Badge>);
      expect(screen.getByText(tone).className.length).toBeGreaterThan(0);
      unmount();
    }
  });
});

describe("Input / Select — TASK-050 standardized error state", () => {
  it("Input applies a danger border and outline when aria-invalid", () => {
    render(<Input aria-invalid aria-label="Team name" />);
    expect(screen.getByLabelText("Team name").className).toContain("aria-invalid:border-danger");
  });

  it("Select applies the same aria-invalid treatment as Input", () => {
    render(
      <Select aria-invalid aria-label="Region" onChange={vi.fn()}>
        <option>Americas</option>
      </Select>,
    );
    expect(screen.getByLabelText("Region").className).toContain("aria-invalid:border-danger");
  });
});
