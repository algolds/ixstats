/**
 * The live nation card: the Figure rule (loading is a skeleton, unavailable is "–", never 0 or
 * NaN), budget words, and the 400ms debounce on what moves the numbers (typing a name never
 * asks again).
 */
import React from "react";
import { act, render, screen } from "@testing-library/react";
import {
  applyStart,
  emptyFoundingDraft,
  type FoundingDraft,
} from "~/app/builder/_founding/lib/founding-draft";

const mockPreview = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: {
    countries: {
      previewFounding: {
        useQuery: (input: unknown, options: unknown) => mockPreview(input, options),
      },
    },
  },
}));

import { NationCard } from "~/app/builder/_founding/components/NationCard";
import { useFoundingPreview } from "~/app/builder/_founding/hooks/useFoundingPreview";

const SUMMARY = {
  gdp: 1.2e12,
  gdpPerCapita: 40_000,
  population: 30e6,
  budgetBalancePercentOfGdp: -2.1,
  budgetBalanceLabel: "Small deficit" as const,
  stability: 62,
  governmentEffectiveness: 70,
  expectedGrowth: 2.4,
};

describe("NationCard", () => {
  it("shows skeletons while the first figures load", () => {
    render(<NationCard summary={undefined} stale={false} />);
    expect(screen.getAllByTestId("figure-loading")).toHaveLength(6);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows a labelled dash for unavailable figures, never 0 or NaN", () => {
    const { rerender } = render(<NationCard summary={null} stale={false} />);
    expect(screen.getAllByLabelText("Unavailable")).toHaveLength(6);
    rerender(<NationCard summary={{ ...SUMMARY, stability: Number.NaN }} stale={false} />);
    expect(screen.getAllByLabelText("Unavailable")).toHaveLength(1);
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it("puts the budget in words, with the share of GDP beside it", () => {
    render(<NationCard summary={SUMMARY} stale={false} />);
    expect(screen.getByText("Small deficit")).toBeInTheDocument();
    expect(screen.getByText("-2.1% of GDP")).toBeInTheDocument();
    expect(screen.getByText("$1.2T")).toBeInTheDocument();
    expect(screen.getByText("+2.4%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "About Stability" })).toBeInTheDocument();
  });

  it("dims stale figures and announces new ones politely", () => {
    const { container } = render(<NationCard summary={SUMMARY} stale />);
    expect(container.querySelector("[data-stale]")).toHaveClass("opacity-60");
    const live = container.querySelector("[aria-live=polite]");
    expect(live).toHaveTextContent("GDP $1.2T");
    expect(live).toHaveTextContent("Budget balance Small deficit");
  });

  it("gives each figure a sentence on Review", () => {
    render(<NationCard summary={SUMMARY} stale={false} size="md" announce={false} />);
    expect(screen.getByText("Your economy produces about $1.2T a year.")).toBeInTheDocument();
  });
});

describe("useFoundingPreview", () => {
  let lastInput: unknown;
  function Harness({ draft }: { draft: FoundingDraft }) {
    const { summary } = useFoundingPreview(draft);
    return <span data-testid="state">{summary === undefined ? "loading" : "ready"}</span>;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    mockPreview.mockReset().mockImplementation((input: unknown) => {
      lastInput = input;
      return { data: undefined, isError: false, isFetching: true, isPlaceholderData: false };
    });
  });
  afterEach(() => jest.useRealTimers());

  it("asks again 400ms after the last change that moves a number", () => {
    const draft = applyStart(emptyFoundingDraft(), "nordic");
    const { rerender } = render(<Harness draft={draft} />);
    expect(lastInput).toMatchObject({ archetypeId: "nordic", populationBand: "medium" });

    const larger = { ...draft, economy: { ...draft.economy, populationBand: "large" as const } };
    rerender(<Harness draft={larger} />);
    act(() => jest.advanceTimersByTime(399));
    expect(lastInput).toMatchObject({ populationBand: "medium" });
    act(() => jest.advanceTimersByTime(1));
    expect(lastInput).toMatchObject({ populationBand: "large" });
  });

  it("never asks again for an identity change", () => {
    const draft = applyStart(emptyFoundingDraft(), "nordic");
    const { rerender } = render(<Harness draft={draft} />);
    const calls = new Set(mockPreview.mock.calls.map(([input]) => JSON.stringify(input)));
    rerender(<Harness draft={{ ...draft, identity: { ...draft.identity, name: "Valoria" } }} />);
    act(() => jest.advanceTimersByTime(1000));
    for (const [input] of mockPreview.mock.calls)
      expect(calls.has(JSON.stringify(input))).toBe(true);
  });

  it("is undefined while loading and null when the preview failed", () => {
    const draft = applyStart(emptyFoundingDraft(), "nordic");
    const { rerender } = render(<Harness draft={draft} />);
    expect(screen.getByTestId("state")).toHaveTextContent("loading");
    mockPreview.mockImplementation(() => ({ data: undefined, isError: true }));
    rerender(<Harness draft={draft} />);
    expect(screen.getByTestId("state")).toHaveTextContent("ready");
  });
});
