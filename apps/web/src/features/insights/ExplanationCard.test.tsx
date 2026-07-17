/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExplanationCard } from "./ExplanationCard";

afterEach(cleanup);

const explanation =
  "Paper Rex is favored primarily due to a aggression advantage over G2 Esports. Aggression shows the widest gap between these two teams and carries the most weight in this prediction.";

describe("ExplanationCard", () => {
  it("renders the explanation as a single plain paragraph when no fragments are provided (default, unchanged behavior)", () => {
    render(<ExplanationCard explanation={explanation} />);
    const paragraph = screen.getByText(explanation);
    expect(paragraph.tagName).toBe("P");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("reconstructs the exact original text when fragments are provided", () => {
    const fragments = [
      { text: "Paper Rex is favored primarily due to a aggression advantage over G2 Esports.", linkedDimensionKey: "aggression" as const },
      {
        text: "Aggression shows the widest gap between these two teams and carries the most weight in this prediction.",
        linkedDimensionKey: "aggression" as const,
      },
    ];
    render(<ExplanationCard explanation={explanation} fragments={fragments} />);
    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === explanation)).toBeInTheDocument();
  });

  it("makes a linked fragment keyboard-reachable and reports it to the caller on selection", () => {
    const onSelectDimension = vi.fn();
    const fragments = [
      { text: "Paper Rex is favored primarily due to a aggression advantage over G2 Esports.", linkedDimensionKey: "aggression" as const },
    ];
    render(<ExplanationCard explanation={explanation} fragments={fragments} onSelectDimension={onSelectDimension} />);

    const linkedSentence = screen.getByRole("button", { name: /Paper Rex is favored/ });
    fireEvent.click(linkedSentence);
    expect(onSelectDimension).toHaveBeenCalledWith("aggression");
  });

  it("does not render a fragment with no linked dimension as interactive", () => {
    const fragments = [{ text: "A short unrelated sentence with no matches at all.", linkedDimensionKey: null }];
    render(<ExplanationCard explanation="A short unrelated sentence with no matches at all." fragments={fragments} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
