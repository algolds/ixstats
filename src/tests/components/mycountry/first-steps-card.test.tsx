/**
 * MyCountry's "First steps" card: one link row per step with its status line, and it stays away
 * once every step is done, the owner hides it, or the nation is not new.
 */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { FirstSteps } from "~/lib/mycountry/first-steps";

const mockState: { data: FirstSteps | null | undefined } = { data: undefined };
const mockMutate = jest.fn();
const mockSetData = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      mycountry: { getFirstSteps: { setData: mockSetData, invalidate: jest.fn() } },
    }),
    mycountry: {
      getFirstSteps: { useQuery: () => ({ data: mockState.data }) },
      dismissFirstSteps: {
        useMutation: (options: { onMutate?: () => void }) => ({
          isPending: false,
          mutate: (input: unknown) => {
            options.onMutate?.();
            mockMutate(input);
          },
        }),
      },
    },
  },
}));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => ({ error: jest.fn() }) }));

import { FirstStepsCard } from "~/components/mycountry/shell/FirstStepsCard";

function steps(done: Partial<Record<string, boolean>> = {}, extra: Partial<FirstSteps> = {}) {
  const ids = ["budget", "tax", "cabinet", "wiki", "capital"] as const;
  return {
    countryId: "c1",
    dismissed: false,
    recent: true,
    items: ids.map((id) => ({ id, done: done[id] ?? false, href: `/to/${id}` })),
    ...extra,
  } satisfies FirstSteps;
}

beforeEach(() => {
  mockState.data = undefined;
  mockMutate.mockClear();
  mockSetData.mockClear();
});

describe("FirstStepsCard", () => {
  it("lists each step as a link with its status line", () => {
    mockState.data = steps({ cabinet: true });
    render(<FirstStepsCard countryId="c1" />);

    expect(screen.getByRole("heading", { level: 2, name: "First steps" })).toBeInTheDocument();
    expect(screen.getByText("1 of 5 done")).toBeInTheDocument();

    const budget = screen.getByRole("link", { name: /Review your budget/ });
    expect(budget).toHaveAttribute("href", "/to/budget");
    expect(within(budget).getByText(/National budget/)).toBeInTheDocument();

    const cabinet = screen.getByRole("link", { name: /Appoint your cabinet/ });
    expect(within(cabinet).getByText("Done")).toBeInTheDocument();

    for (const title of [
      "Set your tax policy",
      "Write your wiki page",
      "Place your capital on the map",
    ]) {
      expect(screen.getByRole("link", { name: new RegExp(title) })).toBeInTheDocument();
    }
  });

  it("hides itself for this nation when the owner chooses Hide", () => {
    mockState.data = steps();
    render(<FirstStepsCard countryId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(mockMutate).toHaveBeenCalledWith({ countryId: "c1" });
    expect(mockSetData).toHaveBeenCalledWith({ countryId: "c1" }, expect.any(Function));
  });

  it.each([
    ["loading", undefined],
    ["no nation", null],
    ["dismissed", steps({}, { dismissed: true, items: [] })],
    ["an established nation", steps({}, { recent: false, items: [] })],
    [
      "every step done",
      steps({ budget: true, tax: true, cabinet: true, wiki: true, capital: true }),
    ],
  ])("renders nothing when %s", (_label, data) => {
    mockState.data = data;
    const { container } = render(<FirstStepsCard countryId="c1" />);
    expect(container).toBeEmptyDOMElement();
  });
});
