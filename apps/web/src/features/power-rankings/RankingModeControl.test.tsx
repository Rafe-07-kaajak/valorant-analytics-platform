// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RankingModeControl } from "./RankingModeControl";

afterEach(cleanup);

describe("RankingModeControl", () => {
  it("marks the current mode as the active tab and renders that mode's content", () => {
    render(
      <RankingModeControl mode="global" onModeChange={vi.fn()}>
        {(mode) => <p>Content for {mode}</p>}
      </RankingModeControl>,
    );
    expect(screen.getByRole("tab", { name: "Global" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Regional" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("Content for global")).toBeInTheDocument();
  });

  it("calls onModeChange when the other mode is activated", () => {
    const onModeChange = vi.fn();
    render(
      <RankingModeControl mode="global" onModeChange={onModeChange}>
        {(mode) => <p>Content for {mode}</p>}
      </RankingModeControl>,
    );
    fireEvent.focus(screen.getByRole("tab", { name: "Regional" }));
    expect(onModeChange).toHaveBeenCalledWith("regional");
  });

  it("gives every TabsTrigger a matching TabsContent so aria-controls always resolves", () => {
    render(
      <RankingModeControl mode="global" onModeChange={vi.fn()}>
        {(mode) => <p>Content for {mode}</p>}
      </RankingModeControl>,
    );
    for (const tab of screen.getAllByRole("tab")) {
      const controlsId = tab.getAttribute("aria-controls");
      expect(controlsId).toBeTruthy();
      expect(document.getElementById(controlsId!)).not.toBeNull();
    }
  });
});
