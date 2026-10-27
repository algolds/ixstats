/** The Lorewards view's `you` focus: the Vault tab shows everything; the Passport shows the trophies only. */
import { render, screen } from "@testing-library/react";
jest.mock("~/trpc/react", () => ({
  api: {
    lorewards: {
      getMyTrophies: { useQuery: jest.fn() },
      getTrophies: { useQuery: jest.fn() },
      getUserStats: { useQuery: jest.fn() },
    },
  },
}));
jest.mock("~/context/auth-context", () => ({
  useUser: jest.fn(),
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("~/components/lorewards/TrophyCards", () => ({
  TrophyCards: () => <p data-testid="trophy-cards" />,
}));
jest.mock("~/components/lorewards/TodayRace", () => ({
  TodayRace: () => <p data-testid="today-race" />,
}));
jest.mock("~/components/lorewards/Standings", () => ({
  Standings: () => <p data-testid="standings" />,
}));
jest.mock("~/components/lorewards/RecentWinners", () => ({ RecentWinners: () => null }));
jest.mock("~/components/lorewards/StreakCalendar", () => ({ StreakCalendar: () => null }));
jest.mock("~/components/lorewards/AwardHistory", () => ({ AwardHistory: () => null }));
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { LorewardsView } from "~/components/lorewards/LorewardsView";

const trophies = {
  wins: { daily: 1, weekly: 0, monthly: 0 },
  runnerUps: 0,
  streak: 0,
  cards: [{ id: "c1", title: "Battle of Kiro" }],
  holderHandle: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useUser).mockReturnValue({ user: { id: "u1" }, isLoaded: true } as never);
  jest.mocked(api.lorewards.getMyTrophies.useQuery).mockReturnValue({
    data: {
      ...trophies,
      wikiUsername: null,
      verified: false,
      unmatched: 0,
      paid: 0,
      todayRank: null,
    },
    isError: false,
  } as never);
  jest.mocked(api.lorewards.getTrophies.useQuery).mockReturnValue({
    data: trophies,
    isError: false,
  } as never);
  jest.mocked(api.lorewards.getUserStats.useQuery).mockReturnValue({ data: undefined } as never);
});

it("renders the trophies, the achievements, today's race and the standings, in that order", () => {
  render(<LorewardsView focus="you" achievements={<p data-testid="achievements" />} />);
  const order = ["trophy-cards", "achievements", "today-race", "standings"].map((id) =>
    screen.getByTestId(id)
  );
  order.slice(1).forEach((node, i) => {
    expect(order[i]!.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

it("renders another author's trophies only, with no race and no standings", () => {
  render(
    <LorewardsView focus="you" username="Kir" achievements={<p data-testid="achievements" />} />
  );
  expect(screen.getByTestId("trophy-cards")).toBeInTheDocument();
  expect(screen.queryByTestId("today-race")).not.toBeInTheDocument();
  expect(screen.queryByTestId("standings")).not.toBeInTheDocument();
  expect(screen.queryByTestId("achievements")).not.toBeInTheDocument();
});
