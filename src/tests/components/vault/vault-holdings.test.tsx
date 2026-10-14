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
      listStoreItems: STORE_ITEMS,
      getPurchasedItems: { purchasedItemIds: [], purchaseCounts: {} },
    };
  });

  it("is an inset list headed Your Vault with the four homes in order", () => {
    const { container } = render(<VaultHoldings />);
    expect(screen.getByRole("heading", { level: 2, name: "Your Vault" })).not.toBeNull();
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
    it("shows unlocked of the total, points and rank with a progress bar", () => {
      render(<VaultHoldings />);
      const link = row(/Achievements/);
      expect(link.getAttribute("href")).toBe("/vault/achievements");
      expect(link.textContent).toContain("42 of 180");
      expect(link.textContent).toContain("1,240 points");
      expect(link.textContent).toContain("#17");
      const bar = within(link).getByRole("progressbar");
      expect(bar.getAttribute("aria-valuenow")).toBe("42");
      expect(bar.getAttribute("aria-valuemax")).toBe("180");
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

    it("says only that a wiki account is needed when none is linked", () => {
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
      const text = row(/Lorewards/).textContent ?? "";
      expect(text).toContain("Needs a linked wiki account");
      expect(text).not.toMatch(/\d/);
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
    expect(link.getAttribute("href")).toBe("/vault/cards");
    expect(link.textContent).toContain("Gallery, inventory and collections");
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

  it("no longer carries the wiki prompt, packs or deck value", () => {
    const { container } = render(<VaultHoldings />);
    expect(container.textContent).not.toMatch(/Link your wiki account|pack|deck value/i);
  });

  it("nests no block element inside a paragraph, loaded or loading", () => {
    const { container, unmount } = render(<VaultHoldings />);
    expect(container.querySelectorAll("p div")).toHaveLength(0);
    unmount();
    mockData = {};
    const loading = render(<VaultHoldings />);
    expect(loading.container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(loading.container.querySelectorAll("p div")).toHaveLength(0);
  });
});
