/**
 * LorewardsView: one view in two homes. The contest focus (WikiOS) leads with today's race, the standings and
 * the history; the you focus (Vault, Passport) leads with the player's trophies. Each links to the other home.
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const query = () => ({ useQuery: jest.fn() });
  return {
    api: {
      lorewards: {
        getTodayRace: query(),
        getStandings: query(),
        getRecentWinners: query(),
        getMyTrophies: query(),
        getTrophies: query(),
        getUserStats: query(),
        getUserAwardHistory: query(),
        getStreakCalendar: query(),
      },
    },
  };
});
jest.mock("~/context/auth-context", () => ({
  useUser: jest.fn(),
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { LorewardsView } from "~/components/lorewards/LorewardsView";
import type { CardFaceData } from "~/lib/cards/face/types";

const lore = api.lorewards;
const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false });

/** A trophy's face, as the server builds it: its art shows. */
const face = (cardId: string, title: string): CardFaceData => ({
  cardId,
  title,
  rarity: "LEGENDARY",
  cardType: "TROPHY",
  realm: { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false },
  artwork: `/art/${cardId}.png`,
  silhouette: false,
  number: null,
  season: null,
  isRetired: false,
  copy: { ownershipId: `own-${cardId}`, finish: "SERIALISED", serialNumber: 1, level: 1 },
});

const TROPHIES = {
  wins: { daily: 6, weekly: 1, monthly: 0 },
  runnerUps: 2,
  streak: 3,
  cards: [
    {
      id: "card1",
      title: "Seastead Law",
      contest: "weekly" as const,
      place: "winner" as const,
      face: face("card1", "Seastead Law"),
    },
    {
      id: "card2",
      title: "Tide Charts",
      contest: "daily" as const,
      place: "runner-up" as const,
      face: face("card2", "Tide Charts"),
    },
  ],
  holderHandle: "ada",
};

beforeEach(() => {
  jest.mocked(useUser).mockReturnValue({ user: { id: "u1" }, isLoaded: true } as never);
  jest.mocked(lore.getTodayRace.useQuery).mockReturnValue(
    ok({
      date: "2026-10-20",
      editCount: 41,
      entries: [
        { rank: 1, user: "Bo", page: "Harbor Treaty", score: 400, bytesAdded: 5000, editCount: 4 },
        { rank: 2, user: "Ada", page: "Tide Charts", score: 300, bytesAdded: 2000, editCount: 2 },
      ],
    }) as never
  );
  jest.mocked(lore.getStandings.useQuery).mockReturnValue(
    ok([
      {
        rank: 1,
        username: "Bo",
        totalScore: 1200,
        dailyWins: 9,
        weeklyWins: 2,
        monthlyWins: 1,
        currentStreak: 4,
      },
    ]) as never
  );
  jest.mocked(lore.getRecentWinners.useQuery).mockReturnValue(
    ok([
      {
        date: "2026-10-19",
        dateStart: null,
        dateEnd: null,
        type: "daily",
        winnerUser: "Ada",
        winnerPage: "Seastead Law",
        winnerScore: 500,
        winnerBytes: 100,
        runnerUpUser: "Bo",
        runnerUpPage: "Harbor Treaty",
      },
    ]) as never
  );
  jest.mocked(lore.getMyTrophies.useQuery).mockReturnValue(
    ok({
      wikiUsername: "Ada",
      verified: true,
      unmatched: 0,
      ...TROPHIES,
      holderHandle: null,
      paid: 2150,
      todayRank: 2,
    }) as never
  );
  jest.mocked(lore.getTrophies.useQuery).mockReturnValue(ok(TROPHIES) as never);
  jest.mocked(lore.getUserStats.useQuery).mockReturnValue(
    ok({
      stats: { currentStreak: 3, longestStreak: 5, totalScore: 900, totalBytes: 12000 },
      rank: 4,
      recentEntries: [],
    }) as never
  );
  jest.mocked(lore.getUserAwardHistory.useQuery).mockReturnValue(
    ok({
      entries: [
        {
          date: "2026-10-19",
          type: "daily",
          role: "winner",
          page: "Seastead Law",
          score: 500,
          bytes: 10,
        },
      ],
      total: 1,
      hasMore: false,
    }) as never
  );
  jest
    .mocked(lore.getStreakCalendar.useQuery)
    .mockReturnValue(ok({ year: 2026, month: 10, days: { 19: "winner" } }) as never);
});

/** The figure of the Stat labelled `label`. */
const statValue = (label: string) =>
  screen.getByText(label).closest('[data-slot="stat"]')?.querySelector('[data-slot="stat-value"]')
    ?.textContent;

const headings = () => screen.getAllByRole("heading").map((h) => h.textContent);

describe("contest focus", () => {
  it("does not load the viewer's trophies", () => {
    render(<LorewardsView focus="contest" />);
    expect(lore.getMyTrophies.useQuery).not.toHaveBeenCalled();
  });
});
describe("you focus", () => {
  it("opens the viewer's own trophy cards in Mine", () => {
    render(<LorewardsView focus="you" />);
    const shelf = within(screen.getByRole("region", { name: "Your trophies" }));
    expect(
      shelf.getByRole("link", { name: "Seastead Law, Legendary, Serialised, Ixnay" })
    ).toHaveAttribute("href", "/vault/cards/mine?card=card1");
  });
  it("asks a signed-out viewer to sign in, with no error and no trophies query", () => {
    jest.mocked(useUser).mockReturnValue({ user: null, isLoaded: true } as never);
    jest.mocked(lore.getMyTrophies.useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as never);
    render(<LorewardsView focus="you" />);

    expect(screen.getByText("Sign in to see your trophies")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong|unavailable/i)).toBeNull();
    expect(lore.getMyTrophies.useQuery).toHaveBeenCalledWith(undefined, { enabled: false });
  });
  it("never offers a verified viewer to verify, even with unmatched places under a label", () => {
    jest.mocked(lore.getMyTrophies.useQuery).mockReturnValue(
      ok({
        wikiUsername: "Ada",
        verified: true,
        unmatched: 2,
        wins: { daily: 0, weekly: 0, monthly: 0 },
        runnerUps: 0,
        streak: 0,
        cards: [],
        paid: 0,
        todayRank: null,
      }) as never
    );
    render(<LorewardsView focus="you" />);

    expect(screen.queryByText("Classic wiki wins need a verified link")).toBeNull();
    expect(screen.queryByRole("link", { name: "Verify your wiki account" })).toBeNull();
    expect(headings()[0]).toBe("Your trophies");
  });

  it("counts an unverified viewer's tied places, without the name's shared record", () => {
    jest.mocked(lore.getMyTrophies.useQuery).mockReturnValue(
      ok({
        wikiUsername: "Ostrozava",
        verified: false,
        unmatched: 1,
        wins: { daily: 1, weekly: 0, monthly: 0 },
        runnerUps: 0,
        streak: 1,
        cards: [],
        paid: 500,
        todayRank: null,
      }) as never
    );
    jest.mocked(lore.getUserAwardHistory.useQuery).mockClear();
    jest.mocked(lore.getStreakCalendar.useQuery).mockClear();
    // A disabled query has no data.
    const stats = jest.mocked(lore.getUserStats.useQuery).getMockImplementation();
    jest
      .mocked(lore.getUserStats.useQuery)
      .mockImplementation((input, options) =>
        options?.enabled === false ? ({ data: undefined } as never) : stats!(input, options)
      );
    render(<LorewardsView focus="you" />);

    expect(headings()[0]).toBe("Your trophies");
    expect(statValue("Daily wins")).toBe("1");
    // The name's stats row, calendar and history may be someone else's: none is read.
    expect(lore.getUserStats.useQuery).toHaveBeenCalledWith(
      { username: "" },
      expect.objectContaining({ enabled: false })
    );
    expect(statValue("Rank")).toBe("Unranked");
    expect(lore.getUserAwardHistory.useQuery).not.toHaveBeenCalled();
    expect(lore.getStreakCalendar.useQuery).not.toHaveBeenCalled();
  });

  it("shows another author's trophies for a username, without payouts", () => {
    jest.mocked(useUser).mockReturnValue({ user: null, isLoaded: true } as never);
    render(<LorewardsView focus="you" username="Ada" />);

    expect(lore.getTrophies.useQuery).toHaveBeenCalledWith(
      { username: "Ada" },
      expect.objectContaining({ enabled: true })
    );
    expect(lore.getMyTrophies.useQuery).toHaveBeenCalledWith(undefined, { enabled: false });
    const shelf = screen.getByRole("region", { name: "Trophies of Ada" });
    expect(screen.queryByText("IxCredits paid")).toBeNull();
    expect(within(shelf).getByText("Seastead Law")).toBeInTheDocument();
    // Another player's trophy opens through their display, which shows its art.
    expect(
      within(shelf).getByRole("link", { name: "Seastead Law, Legendary, Serialised, Ixnay" })
    ).toHaveAttribute("href", "/vault/cards/explore?card=card1&from=holder.ada");
  });
});
