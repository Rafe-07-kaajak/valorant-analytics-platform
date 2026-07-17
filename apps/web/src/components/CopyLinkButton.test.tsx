/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyLinkButton } from "./CopyLinkButton";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CopyLinkButton", () => {
  it("copies the current window location and shows a success message", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<CopyLinkButton />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy Link" }));
    });

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.getByRole("status")).toHaveTextContent("Link copied");
  });

  it("shows a safe fallback message when the clipboard write fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<CopyLinkButton />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy Link" }));
    });

    expect(screen.getByRole("status")).toHaveTextContent("Couldn't copy the link");
  });

  it("does not touch the clipboard before the button is clicked", () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<CopyLinkButton />);
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("clears the success message after a short timeout", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<CopyLinkButton />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy Link" }));
    });
    expect(screen.getByRole("status")).toHaveTextContent("Link copied");

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("cleans up its timeout on unmount without throwing", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const { unmount } = render(<CopyLinkButton />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy Link" }));
    });

    expect(() => unmount()).not.toThrow();
  });

  it("is keyboard accessible as a real button element", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<CopyLinkButton />);
    const button = screen.getByRole("button", { name: "Copy Link" });
    expect(button.tagName).toBe("BUTTON");
  });
});
