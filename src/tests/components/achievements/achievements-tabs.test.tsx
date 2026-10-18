import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

let mockQuery = "";
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockQuery),
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/vault/achievements",
}));
jest.mock("~/components/achievements/tabs/LeaderboardTab", () => ({
  LeaderboardTab: () => <div data-testid="player-board" />,
}));
jest.mock("~/components/achievements/tabs/ShowcaseTab", () => ({
  ShowcaseTab: () => <div data-testid="showcase" />,
}));

import { AchievementsTabs } from "~/components/achievements/AchievementsTabs";
import type { RouterOutputs } from "~/trpc/react";

type AchievementRow = RouterOutputs["achievements"]["getAllWithStatus"][number];

/** The ThinkPages series (3 tiers), all unlocked, so the card opens on tier III by default. */
const level = (key: string, title: string): AchievementRow => ({
  key,
  title,
  description: `${title} description`,
  category: "General",
  rarity: "Common",
  points: 10,
  iconUrl: "Trophy",
  isLegacy: false,
  triggerType: "STAT",
  conditionJson: null,
  isUnlocked: true,
  unlockedAt: "2026-10-01T00:00:00.000Z",
  metadata: null,
  rewards: null,
  globalUnlockPercent: 50,
});
const ACHIEVEMENTS = [
  level("social-first-thinkpage", "First Thinker"),
  level("social-thinkpage-author", "Thought Author"),
  level("social-prolific-author", "Prolific Thinker"),
  level("solo-one", "Standalone One"),
];

function renderTabs(props: { lorewardsPanel?: React.ReactNode; isLoading?: boolean } = {}) {
  return render(
    <AchievementsTabs achievements={ACHIEVEMENTS} isLoading={props.isLoading ?? false} {...props} />
  );
}

beforeEach(() => {
  mockQuery = "";
  mockReplace.mockClear();
});

describe("AchievementsTabs", () => {
  it("shows All, Lorewards, Showcase and Leaderboard when a Lorewards panel is given", () => {
    renderTabs({ lorewardsPanel: <div data-testid="lorewards" /> });
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "All",
      "Lorewards",
      "Showcase",
      "Leaderboard",
    ]);
  });

  // At 320px the four tabs are wider than the page: the track scrolls inside itself, so the page never pans sideways.
  it("scrolls its tab row in its own track rather than widening the page", () => {
    renderTabs({ lorewardsPanel: <div data-testid="lorewards" /> });
    const list = screen.getByRole("tablist", { name: "Achievements sections" });
    expect(list).toHaveClass("max-w-full", "overflow-x-auto");
    for (const tab of within(list).getAllByRole("tab")) expect(tab).toHaveClass("shrink-0");
  });

  it("leaves the Lorewards tab out until a panel is passed", () => {
    renderTabs();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "All",
      "Showcase",
      "Leaderboard",
    ]);
  });

  it("opens on All, with the catalogue", () => {
    renderTabs();
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("searchbox", { name: "Search achievements" })).toBeInTheDocument();
  });

  it.each([
    ["showcase", "showcase"],
    ["leaderboard", "player-board"],
  ])("?tab=%s shows that tab", (tab, testId) => {
    mockQuery = `tab=${tab}`;
    renderTabs();
    expect(screen.getByTestId(testId)).toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "Search achievements" })).toBeNull();
  });

  it("?tab=lorewards shows the panel, and falls back to All without one", () => {
    mockQuery = "tab=lorewards";
    const { unmount } = renderTabs({ lorewardsPanel: <div data-testid="lorewards" /> });
    expect(screen.getByTestId("lorewards")).toBeInTheDocument();
    unmount();
    renderTabs();
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true");
  });

  it("writes the chosen tab to the URL, dropping the achievement key", () => {
    mockQuery = "a=social-prolific-author";
    renderTabs();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Showcase" }), { button: 0 });
    expect(mockReplace).toHaveBeenCalledWith("/vault/achievements?tab=showcase", {
      scroll: false,
    });
  });

  it("writes All as the bare path", () => {
    mockQuery = "tab=showcase";
    renderTabs();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "All" }), { button: 0 });
    expect(mockReplace).toHaveBeenCalledWith("/vault/achievements", { scroll: false });
  });
});

describe("?a=<key>", () => {
  const tierButton = (level: number) => screen.getByTitle(new RegExp(`^Level ${level}:`));

  it("opens the series card on the tier it names, in All", () => {
    mockQuery = "a=social-thinkpage-author";
    renderTabs();
    expect(screen.getByRole("heading", { name: "Thought Author" })).toBeInTheDocument();
    expect(tierButton(2)).toHaveAttribute("aria-pressed", "true");
    expect(tierButton(3)).toHaveAttribute("aria-pressed", "false");
  });

  it("opens on the highest unlocked tier without a key", () => {
    renderTabs();
    expect(screen.getByRole("heading", { name: "Prolific Thinker" })).toBeInTheDocument();
  });

  it("scrolls the achievement's card into view", () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    mockQuery = "a=solo-one";
    renderTabs();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    const card = scrollIntoView.mock.contexts[0] as HTMLElement;
    expect(within(card).getByRole("heading", { name: "Standalone One" })).toBeInTheDocument();
  });

  it("ignores a key that matches nothing", () => {
    mockQuery = "a=nope";
    renderTabs();
    expect(screen.getByRole("heading", { name: "Prolific Thinker" })).toBeInTheDocument();
  });
});
