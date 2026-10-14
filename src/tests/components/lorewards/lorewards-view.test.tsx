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

const lore = api.lorewards;
const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false });

const TROPHIES = {
  wins: { daily: 6, weekly: 1, monthly: 0 },
  runnerUps: 2,
  streak: 3,
  cards: [
    { id: "card1", title: "Seastead Law", contest: "weekly" as const, place: "winner" as const },
    { id: "card2", title: "Tide Charts", contest: "daily" as const, place: "runner-up" as const },
  ],
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
  jest
    .mocked(lore.getMyTrophies.useQuery)
    .mockReturnValue(ok({ wikiUsername: "Ada", ...TROPHIES, paid: 2150, todayRank: 2 }) as never);
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
  it("leads with today's race, then the standings and the history", () => {
    render(<LorewardsView focus="contest" />);

    expect(headings().slice(0, 3)).toEqual(["Today's race", "Standings", "Recent winners"]);
    const race = screen.getByRole("region", { name: "Today's race" });
    expect(within(race).getByText("Harbor Treaty")).toBeInTheDocument();
    expect(within(race).getByText("400 pts")).toBeInTheDocument();
    const standings = screen.getByRole("region", { name: "Standings" });
    expect(within(standings).getByText("Bo")).toBeInTheDocument();
    expect(within(standings).getByText("1,200")).toBeInTheDocument();
    const history = screen.getByRole("region", { name: "Recent winners" });
    expect(within(history).getByText("Seastead Law")).toBeInTheDocument();
  });

  it("links to the player's trophies in the Vault", () => {
    render(<LorewardsView focus="contest" />);
    expect(screen.getByRole("link", { name: /your trophies/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/vault/achievements?tab=lorewards")
    );
  });

  it("does not load the viewer's trophies", () => {
    render(<LorewardsView focus="contest" />);
    expect(lore.getMyTrophies.useQuery).not.toHaveBeenCalled();
  });
});

describe("contest focus with a winner", () => {
  it("shows that winner's public trophies above the race, without calendar or history", () => {
    jest.mocked(useUser).mockReturnValue({ user: null, isLoaded: true } as never);
    render(<LorewardsView focus="contest" username="Ada" highlightCardId="card2" />);

    expect(headings().slice(0, 2)).toEqual(["Trophies of Ada", "Today's race"]);
    expect(lore.getTrophies.useQuery).toHaveBeenCalledWith(
      { username: "Ada" },
      expect.objectContaining({ enabled: true })
    );
    expect(lore.getMyTrophies.useQuery).toHaveBeenCalledWith(undefined, { enabled: false });
    const shelf = within(screen.getByRole("region", { name: "Trophies of Ada" }));
    expect(shelf.getByText("Tide Charts").closest("[data-highlighted]")).not.toBeNull();
    expect(screen.queryByRole("region", { name: "History" })).toBeNull();
    expect(screen.queryByText("IxCredits paid")).toBeNull();
  });
});

describe("you focus", () => {
  it("leads with the viewer's trophies, streak, payouts and trophy cards", () => {
    render(<LorewardsView focus="you" />);

    expect(headings()[0]).toBe("Your trophies");
    expect(headings()).not.toContain("Today's race");
    expect(statValue("Daily wins")).toBe("6");
    expect(statValue("Runner-ups")).toBe("2");
    expect(statValue("Total score")).toBe("900");
    expect(statValue("Rank")).toBe("#4");
    expect(statValue("Streak")).toBe("3");
    expect(statValue("IxCredits paid")).toBe("2,150");
    expect(statValue("Today's race")).toBe("#2");
    const shelf = screen.getByRole("region", { name: "Your trophies" });
    expect(within(shelf).getByText("Seastead Law")).toBeInTheDocument();
    expect(within(shelf).getByText("Weekly winner")).toBeInTheDocument();
    expect(within(shelf).getByText("Daily runner-up")).toBeInTheDocument();
  });

  it("links to today's race and standings in WikiOS", () => {
    render(<LorewardsView focus="you" />);
    expect(screen.getByRole("link", { name: /today's race and standings/i })).toHaveAttribute(
      "href",
      "/util/lorewards"
    );
  });

  it("marks the trophy card the article badge pointed to", () => {
    render(<LorewardsView focus="you" highlightCardId="card2" />);
    const shelf = within(screen.getByRole("region", { name: "Your trophies" }));
    expect(shelf.getByText("Tide Charts").closest("[data-highlighted]")).not.toBeNull();
    expect(shelf.getByText("Seastead Law").closest("[data-highlighted]")).toBeNull();
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

  it("says so when the trophies cannot be loaded, rather than loading forever", () => {
    jest.mocked(lore.getMyTrophies.useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as never);
    render(<LorewardsView focus="you" />);
    expect(screen.getByText("Trophies are unavailable right now.")).toBeInTheDocument();
  });

  it("asks a viewer with no verified wiki account to link it", () => {
    jest.mocked(lore.getMyTrophies.useQuery).mockReturnValue(
      ok({
        wikiUsername: null,
        wins: { daily: 0, weekly: 0, monthly: 0 },
        runnerUps: 0,
        streak: 0,
        cards: [],
        paid: 0,
        todayRank: null,
      }) as never
    );
    render(<LorewardsView focus="you" />);

    expect(screen.getByText("Link your IxWiki account")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open settings" })).toHaveAttribute(
      "href",
      expect.stringContaining("/settings")
    );
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
  });

  it("lists the streak calendar and the history of the wiki account", () => {
    render(<LorewardsView focus="you" />);
    expect(lore.getUserAwardHistory.useQuery).toHaveBeenCalledWith(
      { username: "Ada", limit: 20, offset: 0 },
      expect.objectContaining({ enabled: true })
    );
    expect(screen.getByRole("region", { name: "History" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /^[A-Z][a-z]+ \d{4}$/ })).toBeInTheDocument();
  });
});
