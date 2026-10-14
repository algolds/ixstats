import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/components/vault/IxCreditsSymbol", () => ({ IxCreditsSymbol: () => <i /> }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

let mockData: Record<string, unknown> = {};
let mockErrors = new Set<string>();
const mockLeaf = (name: string) => ({
  useQuery: () => ({
    data: mockData[name],
    isLoading: mockData[name] === undefined && !mockErrors.has(name),
    isError: mockErrors.has(name),
  }),
});
jest.mock("~/trpc/react", () => ({
  api: new Proxy(
    {},
    { get: () => new Proxy({}, { get: (_target, name: string) => mockLeaf(name) }) }
  ),
}));

import { VaultHoldings } from "~/components/vault/sections/dashboard/VaultHoldings";

const STORE_ITEMS = [
  { id: "cheap", name: "Plain frame", price: 100, quality: "COMMON", category: "cosmetics" },
  { id: "fancy", name: "Aurora frame", price: 1200, quality: "EPIC", category: "cosmetics" },
];

const linkTo = (name: RegExp | string) => screen.getByRole("link", { name });

describe("VaultHoldings", () => {
  beforeEach(() => {
    mockErrors = new Set();
    mockData = {
      getMyTrophies: {
        wikiUsername: "Ixnay",
        wins: { daily: 3, weekly: 1, monthly: 0 },
        runnerUps: 2,
        streak: 2,
        paid: 4000,
        cards: [],
        todayRank: 4,
      },
      getMySummary: { unlocked: 42, activeTotal: 180, points: 1240, rank: 17 },
      listStoreItems: STORE_ITEMS,
      getPurchasedItems: { purchasedItemIds: [], purchaseCounts: {} },
      listWikiLinks: [{ source: "ixwiki", username: "Ixnay", verified: true, pending: false }],
    };
  });

  const renderHoldings = (props: Partial<React.ComponentProps<typeof VaultHoldings>> = {}) =>
    render(<VaultHoldings totalCards={312} deckValue={6440} unopenedPacks={0} {...props} />);

  it("shows achievement progress and links to the achievements page", () => {
    renderHoldings();
    const link = linkTo(/Achievements/);
    expect(link.getAttribute("href")).toBe("/vault/achievements");
    expect(link.textContent).toContain("42 of 180");
    expect(link.textContent).toContain("1,240 points");
    expect(link.textContent).toContain("Rank 17");
  });

  it("leaves the rank out for an unranked player and offers no closest-to-unlocking line", () => {
    mockData.getMySummary = { unlocked: 0, activeTotal: 180, points: 0, rank: null };
    renderHoldings();
    const link = linkTo(/Achievements/);
    expect(link.textContent).not.toContain("Rank");
    expect(link.textContent).not.toMatch(/closest/i);
  });

  it("shows the card count and deck value and links to Cards", () => {
    renderHoldings();
    const link = linkTo(/Cards/);
    expect(link.getAttribute("href")).toBe("/vault/cards");
    expect(link.textContent).toContain("312 cards");
    expect(link.textContent).toContain("6,440");
    expect(link.textContent).not.toMatch(/sets? in progress/i);
  });

  it("mentions waiting packs only when there are some", () => {
    const { unmount } = renderHoldings();
    expect(linkTo(/Cards/).textContent).not.toMatch(/waiting/);
    unmount();
    renderHoldings({ unopenedPacks: 2 });
    expect(linkTo(/Cards/).textContent).toContain("2 packs waiting");
  });

  it("features one store item and links to the Store", () => {
    renderHoldings();
    const link = linkTo(/Store/);
    expect(link.getAttribute("href")).toBe("/vault/store");
    expect(link.textContent).toContain("Aurora frame");
    expect(link.textContent).toContain("1,200");
    expect(link.textContent).not.toContain("Plain frame");
  });

  it("falls back to a plain Store link when nothing is left to feature", () => {
    mockData.getPurchasedItems = {
      purchasedItemIds: ["cheap", "fancy"],
      purchaseCounts: { cheap: 1, fancy: 1 },
    };
    renderHoldings();
    expect(linkTo(/Store/).textContent).toContain("Browse the store");
  });

  it("prompts to link a wiki account only when none is verified", () => {
    const { unmount } = renderHoldings();
    expect(screen.queryByText(/Link your wiki account/)).toBeNull();
    unmount();

    mockData.listWikiLinks = [
      { source: "ixwiki", username: "Ixnay", verified: false, pending: true },
    ];
    renderHoldings();
    const prompt = screen.getByRole("link", { name: /Link your wiki account/ });
    expect(prompt.getAttribute("href")).toBe("/settings?tab=account");
  });

  it("stays quiet about the wiki link while the links load", () => {
    delete mockData.listWikiLinks;
    renderHoldings();
    expect(screen.queryByText(/Link your wiki account/)).toBeNull();
  });

  it("shows a dash for the deck value when the stats failed", () => {
    renderHoldings({ deckValue: null });
    expect(linkTo(/Cards/).querySelector('[aria-label="Unavailable"]')).not.toBeNull();
  });

  it("shows no card count while the stats load, and says unavailable when they failed", () => {
    const { unmount } = renderHoldings({ totalCards: undefined, deckValue: undefined });
    expect(linkTo(/Cards/).textContent).not.toMatch(/\d+ cards/);
    expect(linkTo(/Cards/).textContent).not.toContain("Unavailable");
    unmount();
    renderHoldings({ totalCards: null, deckValue: null });
    expect(linkTo(/Cards/).textContent).toContain("Unavailable");
    expect(linkTo(/Cards/).textContent).not.toMatch(/\d+ cards/);
  });

  it("uses the singular for a single card", () => {
    renderHoldings({ totalCards: 1 });
    expect(linkTo(/Cards/).textContent).toContain("1 card");
    expect(linkTo(/Cards/).textContent).not.toContain("1 cards");
  });

  it("uses the singular for a single waiting pack", () => {
    renderHoldings({ unopenedPacks: 1 });
    expect(linkTo(/Cards/).textContent).toContain("1 pack waiting");
  });

  it("nests no block element inside a paragraph, loaded or loading", () => {
    const { container, rerender } = renderHoldings({ unopenedPacks: 2 });
    expect(container.querySelectorAll("p div")).toHaveLength(0);
    rerender(<VaultHoldings totalCards={undefined} deckValue={undefined} unopenedPacks={2} />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll("p div")).toHaveLength(0);
  });

  describe("Lorewards", () => {
    it("shows wins, runner-ups and today's rank, and links to the Lorewards tab", () => {
      renderHoldings();
      const link = linkTo(/Lorewards/);
      expect(link.getAttribute("href")).toBe("/vault/achievements?tab=lorewards");
      expect(link.textContent).toContain("4 wins");
      expect(link.textContent).toContain("3 daily, 1 weekly");
      expect(link.textContent).not.toContain("monthly");
      expect(link.textContent).toContain("2 runner-ups");
      expect(link.textContent).toContain("Today's race: #4");
    });

    it("leaves today's rank out when it is not known", () => {
      mockData.getMyTrophies = {
        ...(mockData.getMyTrophies as object),
        todayRank: null,
      };
      renderHoldings();
      expect(linkTo(/Lorewards/).textContent).not.toContain("Today's race");
    });

    it("says nothing about wins for an unlinked wiki account, leaving the prompt to carry it", () => {
      mockData.getMyTrophies = {
        wikiUsername: null,
        wins: { daily: 0, weekly: 0, monthly: 0 },
        runnerUps: 0,
        streak: 0,
        paid: 0,
        cards: [],
        todayRank: null,
      };
      renderHoldings();
      const text = linkTo(/Lorewards/).textContent ?? "";
      expect(text).not.toMatch(/\d+ wins?|runner-up/);
      expect(text).toContain("Needs a linked wiki account");
    });

    it("shows a skeleton while loading and no figures when the query fails", () => {
      delete mockData.getMyTrophies;
      const { unmount } = renderHoldings();
      expect(linkTo(/Lorewards/).querySelector('[data-slot="skeleton"]')).not.toBeNull();
      unmount();

      mockErrors = new Set(["getMyTrophies"]);
      renderHoldings();
      const link = linkTo(/Lorewards/);
      expect(link.querySelector('[data-slot="skeleton"]')).toBeNull();
      expect(link.textContent).toContain("Unavailable");
      expect(link.textContent).not.toMatch(/\d/);
    });

    it("sits between Achievements and Cards", () => {
      const { container } = renderHoldings();
      const titles = Array.from(container.querySelectorAll('[data-slot="card-title"]')).map(
        (el) => el.textContent
      );
      expect(titles).toEqual(["Achievements", "Lorewards", "Cards", "Store"]);
    });
  });
});
