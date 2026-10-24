/**
 * The margin drawer's race chip: the viewer's place and the leader of today's race, the leader alone for a signed-out
 * reader or one with no entry, and nothing while either read is loading or failed.
 */
import { render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    lorewards: {
      getTodayRace: { useQuery: jest.fn() },
      getMyRace: { useQuery: jest.fn() },
    },
  },
}));

import { api } from "~/trpc/react";
import { MarginRaceChip } from "~/components/wiki-os/margin/MarginRaceChip";

interface RaceEntry {
  rank: number;
  user: string;
  score: number;
}

function entry(rank: number, user: string, score: number): RaceEntry {
  return { rank, user, score };
}

function mockRace(entries: RaceEntry[] | undefined) {
  jest.mocked(api.lorewards.getTodayRace.useQuery).mockReturnValue({
    data: entries && {
      date: "2026-10-23",
      editCount: 40,
      entries: entries.map((e) => ({ ...e, page: "Urcea", bytesAdded: 100, editCount: 2 })),
    },
  } as never);
}

function mockMine(data: { entry: { rank: number; score: number } | null } | undefined) {
  jest.mocked(api.lorewards.getMyRace.useQuery).mockReturnValue({ data } as never);
}

beforeEach(() => jest.clearAllMocks());

it("shows the viewer's place and the leader", () => {
  mockRace([entry(1, "Lead Writer", 1200), entry(2, "Other", 900), entry(3, "Me", 840)]);
  mockMine({ entry: { rank: 3, score: 840 } });
  render(<MarginRaceChip isAuthenticated enabled />);
  expect(
    screen.getByText("Today's race: you #3 · 840 pts · leader Lead Writer 1,200 pts")
  ).toBeTruthy();
  expect(screen.getByRole("link").getAttribute("href")).toBe("/util/lorewards");
});

it("says the viewer leads when they hold first place", () => {
  mockRace([entry(1, "Me", 1500), entry(2, "Other", 900)]);
  mockMine({ entry: { rank: 1, score: 1500 } });
  render(<MarginRaceChip isAuthenticated enabled />);
  expect(screen.getByText("Today's race: you lead with 1,500 pts")).toBeTruthy();
});

it("shows the leader to a signed-in viewer with no entry", () => {
  mockRace([entry(1, "Lead Writer", 1200)]);
  mockMine({ entry: null });
  render(<MarginRaceChip isAuthenticated enabled />);
  expect(screen.getByText("Today's race: Lead Writer leads with 1,200 pts")).toBeTruthy();
});

it("shows the leader to a signed-out reader and never asks for their entry", () => {
  mockRace([entry(1, "Lead Writer", 1200)]);
  mockMine(undefined);
  render(<MarginRaceChip isAuthenticated={false} enabled />);
  expect(screen.getByText("Today's race: Lead Writer leads with 1,200 pts")).toBeTruthy();
  expect(jest.mocked(api.lorewards.getMyRace.useQuery).mock.calls[0]?.[1]).toMatchObject({
    enabled: false,
  });
});

it("says so when no edit has scored yet", () => {
  mockRace([]);
  mockMine({ entry: null });
  render(<MarginRaceChip isAuthenticated enabled />);
  expect(screen.getByText("Today's race: no scoring edits yet")).toBeTruthy();
});

it("runs neither read while the drawer is closed", () => {
  mockRace(undefined);
  mockMine(undefined);
  render(<MarginRaceChip isAuthenticated enabled={false} />);
  expect(jest.mocked(api.lorewards.getTodayRace.useQuery).mock.calls[0]?.[1]).toMatchObject({
    enabled: false,
  });
  expect(jest.mocked(api.lorewards.getMyRace.useQuery).mock.calls[0]?.[1]).toMatchObject({
    enabled: false,
  });
});

it("renders nothing while the race is loading", () => {
  mockRace(undefined);
  mockMine({ entry: { rank: 3, score: 840 } });
  const { container } = render(<MarginRaceChip isAuthenticated enabled />);
  expect(container.innerHTML).toBe("");
});

it("renders nothing while the viewer's entry is loading", () => {
  mockRace([entry(1, "Lead Writer", 1200)]);
  mockMine(undefined);
  const { container } = render(<MarginRaceChip isAuthenticated enabled />);
  expect(container.innerHTML).toBe("");
});
