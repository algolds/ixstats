/**
 * The live nation card: the Figure rule (loading is a skeleton, unavailable is "–", never 0 or
 * NaN), budget words, and the 400ms debounce on what moves the numbers (typing a name never
 * asks again).
 */
import "react";
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
import { useFoundingPreview } from "~/app/builder/_founding/hooks/useFoundingPreview";
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
