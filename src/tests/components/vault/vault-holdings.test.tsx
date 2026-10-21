import React from "react";
import { render, screen, within } from "@testing-library/react";

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

jest.mock("~/components/vault/DailyRewardProvider", () => ({
  useDailyReward: () => ({ open: jest.fn() }),
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

const row = (name: RegExp | string) => screen.getByRole("link", { name });

describe("VaultHoldings (Your Vault)", () => {
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
      getMySummary: { unlocked: 42, activeTotal: 180, points: 1240, rank: 17, latest: null },
      getBalance: { credits: 10, canClaimDailyBonus: true, loginStreak: 3 },
      listStoreItems: STORE_ITEMS,
      getPurchasedItems: { purchasedItemIds: [], purchaseCounts: {} },
    };
  });

  it("is titled Vault with the mark, over an inset list named Your Vault with the four homes in order", () => {
    const { container } = render(<VaultHoldings />);
    expect(screen.queryByRole("heading", { level: 2, name: "Your Vault" })).toBeNull();
    expect(screen.getByRole("list", { name: "Your Vault" })).not.toBeNull();
    const title = screen.getByRole("heading", { level: 1, name: "Vault" });
    // The in-column title is the page's own title: hidden wherever the shell header shows.
    const row = title.closest("[data-shell-page-title]") as HTMLElement;
    expect(row).not.toBeNull();
    const tile = row.querySelector("span.bg-tint-fill") as HTMLElement;
    expect(tile.getAttribute("aria-hidden")).toBe("true");
    expect(tile.className).toContain("size-12");
    expect(tile.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    expect(tile.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The daily reward tile is the first item under the title, above the list.
    const tileEl = container.querySelector('[data-slot="daily-reward-tile"]') as HTMLElement;
    const list = container.querySelector('[data-slot="facet-list"]') as HTMLElement;
    expect(row.nextElementSibling!.contains(tileEl)).toBe(true);
    expect(tileEl.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('[data-slot="facet-list"]')).not.toBeNull();
    const titles = screen.getAllByRole("link").map((link) => link.textContent);
    expect(titles[0]).toMatch(/^Achievements/);
    expect(titles[1]).toMatch(/^Lorewards/);
    expect(titles[2]).toMatch(/^Cards/);
    expect(titles[3]).toMatch(/^Store/);
    expect(titles).toHaveLength(4);
  });

  it("gives every row a tinted icon and a chevron", () => {
    render(<VaultHoldings />);
    for (const link of screen.getAllByRole("link")) {
      expect(link.querySelector('[data-slot="facet-row-leading"] svg')).not.toBeNull();
      expect(link.querySelector('[data-slot="facet-row-leading"] .text-tint')).not.toBeNull();
      expect(link.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
    }
  });

  describe("Achievements", () => {
    it("shows unlocked of the total, points and rank, with no progress bar", () => {
      render(<VaultHoldings />);
      const link = row(/Achievements/);
      expect(link.getAttribute("href")).toBe("/vault/achievements");
      expect(link.textContent).toContain("42 of 180");
      expect(link.textContent).toContain("1,240 points");
      expect(link.textContent).toContain("#17");
      expect(within(link).queryByRole("progressbar")).toBeNull();
    });

    it("leaves the rank out for an unranked player", () => {
      mockData.getMySummary = {
        unlocked: 0,
        activeTotal: 180,
        points: 0,
        rank: null,
        latest: null,
      };
      render(<VaultHoldings />);
      expect(row(/Achievements/).textContent).not.toContain("#");
    });

    it("shows a skeleton while loading and no figures when the query fails", () => {
      delete mockData.getMySummary;
      const { unmount } = render(<VaultHoldings />);
      expect(row(/Achievements/).querySelector('[data-slot="skeleton"]')).not.toBeNull();
      unmount();

      mockErrors = new Set(["getMySummary"]);
      render(<VaultHoldings />);
      expect(row(/Achievements/).textContent).toContain("Unavailable");
      expect(row(/Achievements/).textContent).not.toMatch(/\d/);
    });
  });

  describe("Lorewards", () => {
    it("shows wins and today's rank, and links to the Lorewards tab", () => {
      render(<VaultHoldings />);
      const link = row(/Lorewards/);
      expect(link.getAttribute("href")).toBe("/vault/achievements?tab=lorewards");
      expect(link.textContent).toContain("4 wins");
      expect(link.textContent).toContain("Today #4");
    });

    it("uses the singular for one win and leaves today's rank out when unknown", () => {
      mockData.getMyTrophies = {
        ...(mockData.getMyTrophies as object),
        wins: { daily: 1, weekly: 0, monthly: 0 },
        todayRank: null,
      };
      render(<VaultHoldings />);
      expect(row(/Lorewards/).textContent).toContain("1 win");
      expect(row(/Lorewards/).textContent).not.toContain("1 wins");
      expect(row(/Lorewards/).textContent).not.toContain("Today");
    });

    it("invites a player with no wiki edits to take part, never asking for a link", () => {
      mockData.getMyTrophies = {
        wikiUsername: null,
        wins: { daily: 0, weekly: 0, monthly: 0 },
        runnerUps: 0,
        streak: 0,
        paid: 0,
        cards: [],
        todayRank: null,
      };
      render(<VaultHoldings />);
      const link = row(/Lorewards/);
      expect(link.getAttribute("href")).toBe("/vault/achievements?tab=lorewards");
      expect(link.textContent).toContain("Edit the wiki to take part");
      expect(link.textContent).not.toMatch(/\d/);
    });

    it("shows a skeleton while loading and no figures when the query fails", () => {
      delete mockData.getMyTrophies;
      const { unmount } = render(<VaultHoldings />);
      expect(row(/Lorewards/).querySelector('[data-slot="skeleton"]')).not.toBeNull();
      unmount();

      mockErrors = new Set(["getMyTrophies"]);
      render(<VaultHoldings />);
      expect(row(/Lorewards/).querySelector('[data-slot="skeleton"]')).toBeNull();
      expect(row(/Lorewards/).textContent).toContain("Unavailable");
      expect(row(/Lorewards/).textContent).not.toMatch(/\d/);
    });
  });

  it("links Cards to the card hub with no figures", () => {
    render(<VaultHoldings />);
    const link = row(/^Cards/);
    expect(link.getAttribute("href")).toBe("/vault/cards/mine");
    expect(link.textContent).toContain("Mine, sets, market and explore");
    expect(link.textContent).not.toMatch(/\d/);
  });

  describe("Store", () => {
    it("features one item with its price and links to the Store", () => {
      render(<VaultHoldings />);
      const link = row(/^Store/);
      expect(link.getAttribute("href")).toBe("/vault/store");
      expect(link.textContent).toContain("Aurora frame");
      expect(link.textContent).toContain("1,200");
      expect(link.textContent).not.toContain("Plain frame");
    });

    it("falls back to a plain line when nothing is left to feature", () => {
      mockData.getPurchasedItems = {
        purchasedItemIds: ["cheap", "fancy"],
        purchaseCounts: { cheap: 1, fancy: 1 },
      };
      render(<VaultHoldings />);
      expect(row(/^Store/).textContent).toContain("Browse the store");
    });

    it("shows a skeleton while the items load", () => {
      delete mockData.listStoreItems;
      render(<VaultHoldings />);
      expect(row(/^Store/).querySelector('[data-slot="skeleton"]')).not.toBeNull();
    });
  });

  it("carries no wiki prompt while the account is linked, and no packs or deck value", () => {
    const { container } = render(<VaultHoldings />);
    expect(container.textContent).not.toMatch(
      /Link your wiki account|Edit the wiki|pack|deck value/i
    );
  });

  it("marks each home with a tinted icon tile under a dots texture", () => {
    const { container } = render(<VaultHoldings />);
    const tiles = container.querySelectorAll("span.bg-tint-fill.overflow-hidden");
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of Array.from(tiles)) {
      expect(tile.querySelector(".facet-texture-dots")).not.toBeNull();
      expect(tile.querySelector("svg")).not.toBeNull();
    }
  });

  it("nests no block element inside a paragraph or a span, loaded or loading", () => {
    const { container, unmount } = render(<VaultHoldings />);
    expect(container.querySelectorAll("p div, span div:not(.texture-overlay)")).toHaveLength(0);
    unmount();
    mockData = {};
    const loading = render(<VaultHoldings />);
    expect(loading.container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(
      loading.container.querySelectorAll("p div, span div:not(.texture-overlay)")
    ).toHaveLength(0);
  });
});
