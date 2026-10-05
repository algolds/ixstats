import React from "react";
import { render, screen } from "@testing-library/react";

let stats: { activeEvents: number; criticalEvents: number } | undefined;
const useQuery = jest.fn((_input: unknown, _opts?: unknown) => ({ data: stats }));
jest.mock("~/trpc/react", () => ({
  api: {
    crisisEvents: {
      getStatistics: { useQuery: (input: unknown, opts?: unknown) => useQuery(input, opts) },
    },
  },
}));

import { CrisisSignal } from "~/components/mycountry/shell/CrisisSignal";

describe("CrisisSignal", () => {
  beforeEach(() => useQuery.mockClear());

  it("asks only for the player's own country, never the world's crises", () => {
    stats = { activeEvents: 0, criticalEvents: 0 };
    render(<CrisisSignal countryId="c1" />);
    expect(useQuery).toHaveBeenCalledWith(
      { timeframe: "month", countryId: "c1" },
      { enabled: true }
    );
  });

  it("renders nothing without active crises", () => {
    stats = { activeEvents: 0, criticalEvents: 0 };
    const { container } = render(<CrisisSignal countryId="c1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while the statistics load", () => {
    stats = undefined;
    const { container } = render(<CrisisSignal countryId="c1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a warning status with the count and a way to the directives", () => {
    stats = { activeEvents: 2, criticalEvents: 0 };
    render(<CrisisSignal countryId="c1" />);
    const signal = screen.getByRole("status");
    expect(signal).toHaveTextContent("2 active crises");
    expect(screen.getByRole("link", { name: "Review in Directives" })).toHaveAttribute(
      "href",
      "/mycountry/executive"
    );
  });

  it("escalates to a destructive alert when a crisis is critical", () => {
    stats = { activeEvents: 1, criticalEvents: 1 };
    render(<CrisisSignal countryId="c1" />);
    expect(screen.getByRole("alert")).toHaveTextContent("1 active crisis");
  });
});
