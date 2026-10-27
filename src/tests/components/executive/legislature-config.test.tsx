/**
 * Legislature setup keeps a saved multi-chamber layout when the tab is left and reopened: with the
 * legislature already cached, the form used to hydrate and then be overwritten by a unicameral
 * sync effect that still saw the initial "unicameral" form, leaving one default chamber.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockLegislature = {
  name: "Dàl",
  chamberType: "bicameral|Dàl:500:mixed:elected;Tocomra:40:fptp:appointed",
  totalSeats: 540,
  electoralSystem: "mixed",
  termLength: 5,
  electionCycle: "fixed",
};
let mockData: object | null = mockLegislature;
const mockMutate = jest.fn();

jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      elections: {
        getElectionStatus: { invalidate: jest.fn() },
        getElections: { invalidate: jest.fn() },
        getCurrentParliament: { invalidate: jest.fn() },
      },
    }),
    elections: {
      getLegislature: { useQuery: () => ({ data: mockData, refetch: jest.fn() }) },
      configureLegislature: {
        useMutation: () => ({ mutate: mockMutate, isPending: false }),
      },
    },
  },
}));

import { LegislatureConfig } from "~/components/executive/politics/LegislatureConfig";

const chamberNames = () =>
  screen.queryAllByPlaceholderText(/^Chamber \d$/).map((el) => (el as HTMLInputElement).value);

describe("LegislatureConfig", () => {
  beforeEach(() => {
    mockData = mockLegislature;
    mockMutate.mockClear();
  });

  it("shows the saved chambers when it mounts with the legislature already loaded", () => {
    const first = render(<LegislatureConfig countryId="c1" />);
    expect(chamberNames()).toEqual(["Dàl", "Tocomra"]);
    first.unmount();

    // Leaving the tab and coming back remounts it from the cache.
    render(<LegislatureConfig countryId="c1" />);
    expect(chamberNames()).toEqual(["Dàl", "Tocomra"]);
  });

  it("mirrors the main inputs into the one chamber of a unicameral legislature", () => {
    mockData = {
      ...mockLegislature,
      name: "Qangreč",
      chamberType: "unicameral|Qangreč:438:mixed:appointed",
      totalSeats: 438,
    };
    render(<LegislatureConfig countryId="c1" />);
    fireEvent.change(screen.getByPlaceholderText("e.g. National Assembly"), {
      target: { value: "Grand Qangreč" },
    });
    fireEvent.click(screen.getByRole("button", { name: /update legislature/i }));
    fireEvent.click(screen.getByRole("button", { name: /dissolve and update/i }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Grand Qangreč",
        chamberType: "unicameral|Grand Qangreč:438:mixed:appointed",
      })
    );
  });
});
