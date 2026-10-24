/** The viewer's Lorewards pane: their trophy cards always, and the pointer to claim an old IxWiki name. */
import { render, screen, within } from "@testing-library/react";
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
  TrophyCards: ({ cards }: { cards: Array<{ id: string; title: string }> }) => (
    <ul>
      {cards.map((card) => (
        <li key={card.id}>{card.title}</li>
      ))}
    </ul>
  ),
}));
jest.mock("~/components/lorewards/StreakCalendar", () => ({ StreakCalendar: () => null }));
jest.mock("~/components/lorewards/AwardHistory", () => ({ AwardHistory: () => null }));
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { YourLorewards } from "~/components/lorewards/YourLorewards";

interface Mine {
  wikiUsername: string | null;
  verified: boolean;
  unmatched: number;
  cards: Array<{ id: string; title: string }>;
}

function mockViewer(mine: Mine) {
  jest.mocked(useUser).mockReturnValue({ user: { id: "u1" }, isLoaded: true } as never);
  jest.mocked(api.lorewards.getMyTrophies.useQuery).mockReturnValue({
    data: {
      wins: { daily: 0, weekly: 0, monthly: 0 },
      runnerUps: 0,
      streak: 0,
      holderHandle: null,
      paid: 0,
      todayRank: null,
      ...mine,
    },
    isError: false,
  } as never);
  jest.mocked(api.lorewards.getTrophies.useQuery).mockReturnValue({ data: undefined } as never);
  jest.mocked(api.lorewards.getUserStats.useQuery).mockReturnValue({ data: undefined } as never);
}

const pointer = () => screen.queryByRole("status");

beforeEach(() => jest.clearAllMocks());

it("shows a viewer with no wiki name their trophy cards and the pointer to claim one", () => {
  mockViewer({
    wikiUsername: null,
    verified: false,
    unmatched: 0,
    cards: [{ id: "c1", title: "Battle of Kiro" }],
  });
  render(<YourLorewards />);
  expect(screen.queryByText("No wiki edits yet")).not.toBeInTheDocument();
  expect(screen.getByText("Battle of Kiro")).toBeInTheDocument();
  const signal = within(pointer() as HTMLElement);
  expect(signal.getByText("Claim your old IxWiki names")).toBeInTheDocument();
  expect(
    signal.getByText(
      "Edited the classic wiki before WikiOS? Claim the names you used in Settings, and once an administrator approves one, its wins, trophy cards and payouts come to you."
    )
  ).toBeInTheDocument();
  expect(signal.getByRole("link", { name: "Claim a name" })).toHaveAttribute(
    "href",
    "/settings?tab=account"
  );
});

it("names the viewer's unmatched wiki name in the pointer", () => {
  mockViewer({ wikiUsername: "Kir", verified: false, unmatched: 2, cards: [] });
  render(<YourLorewards />);
  expect(
    within(pointer() as HTMLElement).getByText(
      "Some classic wiki wins under Kir may be yours. Claim the name in Settings, and once an administrator approves it, its wins, trophy cards and payouts come to you."
    )
  ).toBeInTheDocument();
  expect(screen.getByText(/No trophy cards yet/)).toBeInTheDocument();
});

it("keeps the general pointer when unmatched places come with no name", () => {
  mockViewer({ wikiUsername: null, verified: false, unmatched: 3, cards: [] });
  render(<YourLorewards />);
  expect(
    within(pointer() as HTMLElement).getByText(/^Edited the classic wiki before WikiOS\?/)
  ).toBeInTheDocument();
});

it("shows a viewer with an approved name no pointer", () => {
  mockViewer({
    wikiUsername: "Kir",
    verified: true,
    unmatched: 0,
    cards: [{ id: "c1", title: "Battle of Kiro" }],
  });
  render(<YourLorewards />);
  expect(pointer()).not.toBeInTheDocument();
  expect(screen.queryByText("Claim your old IxWiki names")).not.toBeInTheDocument();
  expect(screen.getByText("Battle of Kiro")).toBeInTheDocument();
});

it("leaves today's race out for a viewer with no wiki name, who cannot be in it", () => {
  mockViewer({ wikiUsername: null, verified: false, unmatched: 0, cards: [] });
  render(<YourLorewards />);
  expect(screen.queryByText("Today's race")).not.toBeInTheDocument();
  expect(screen.queryByText("Not in the top 10")).not.toBeInTheDocument();
});

it("shows today's race to a viewer with a wiki name", () => {
  mockViewer({ wikiUsername: "Kir", verified: true, unmatched: 0, cards: [] });
  render(<YourLorewards />);
  expect(screen.getByText("Today's race")).toBeInTheDocument();
  expect(screen.getByText("Not in the top 10")).toBeInTheDocument();
});
