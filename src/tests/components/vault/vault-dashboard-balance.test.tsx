import React from "react";
import { render, within } from "@testing-library/react";

const BALANCE = 12345;

jest.mock("~/components/vault/IxCreditsSymbol", () => ({ IxCreditsSymbol: () => <i /> }));
jest.mock("~/components/ui/number-flow", () => ({
  NumberFlowDisplay: ({ value }: { value: number }) => <span>{value.toLocaleString()}</span>,
}));
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
// The statement and the showcase render for real; only their data and heavy art are stubbed.
jest.mock("next/dynamic", () => () => () => null);
jest.mock("~/components/cards/display/CardDisplay", () => ({
  CardDisplay: ({ card }: { card: { title: string } }) => (
    <div data-testid="gallery-card">{card.title}</div>
  ),
}));
jest.mock("~/components/cards/pack-opening/PackHolographicCover", () => ({
  PackHolographicCover: () => <div />,
}));
jest.mock("~/hooks/vault/useVaultStats", () => ({
  useVaultStats: () => ({
    loading: false,
    error: false,
    stats: { deckValue: 5000, totalCards: 12 },
  }),
}));

const mockRouters = new Set<string>();
const mockFetch = jest.fn();
const mockData: Record<string, unknown> = {};
const LATEST = {
  key: "first-trade",
  title: "First trade",
  rarity: "Rare",
  category: "Cards",
  iconUrl: "Cart",
  reward: 100,
};
jest.mock("~/trpc/react", () => ({
  api: new Proxy(
    {},
    {
      get: (_target, router: string) => {
        if (router === "useUtils")
          return () => ({ vault: { getTransactions: { fetch: mockFetch } } });
        mockRouters.add(router);
        return new Proxy(
          {},
          {
            get: (_t, name: string) => ({
              useQuery: () => ({ data: mockData[name], isLoading: false, isError: false }),
            }),
          }
        );
      },
    }
  ),
}));

import { VaultDashboardSection } from "~/components/vault/sections/VaultDashboardSection";

const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;
const statementCard = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-slot="card-title"]'))
    .find((title) => title.textContent === "Statement")
    ?.closest('[data-slot="card"]') as HTMLElement;
const slot = (container: HTMLElement, name: string) =>
  name === "vault-statement"
    ? statementCard(container)
    : (container.querySelector(`[data-slot="${name}"]`) as HTMLElement);
const follows = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("Vault Wallet page", () => {
  beforeEach(() => {
    mockRouters.clear();
    Object.assign(mockData, {
      getBalance: { credits: BALANCE, canClaimDailyBonus: true, loginStreak: 1 },
      getVaultLevel: { vaultLevel: 4 },
      getTodayEarnings: { total: 0, sources: [], transactionCount: 0 },
      getMySummary: { unlocked: 1, activeTotal: 2, points: 3, rank: 4, latest: LATEST },
      getMyTrophies: null,
      getTransactions: {
        hasMore: false,
        transactions: [
          {
            id: "t1",
            createdAt: new Date(),
            credits: 100,
            balanceAfter: 777,
            type: "EARN_ACTIVE",
            source: "DAILY_LOGIN_CREDITS",
            metadata: null,
          },
        ],
      },
      getMyTopCards: [
        {
          id: "o1",
          cards: {
            id: "c1",
            title: "Ostrozava 1st Ed.",
            rarity: "LEGENDARY",
            marketValue: 2400,
            cardType: "NS_IMPORT",
            artwork: "/art/c1.png",
          },
        },
      ],
      getMyPacks: {
        success: true,
        packs: [{ id: "up1", pack: { name: "Veteran", packType: "BASIC" } }],
      },
      listStoreItems: [],
      getPurchasedItems: { purchasedItemIds: [], purchaseCounts: {} },
      listWikiLinks: [{ source: "ixwiki", username: "Ixnay", verified: true, pending: false }],
    });
  });

  it("shows the IxCredits balance once, in the balance card, with no net worth anywhere", () => {
    const { container } = render(<VaultDashboardSection />);
    expect(occurrences(container.textContent ?? "", BALANCE.toLocaleString())).toBe(1);
    expect(
      occurrences(slot(container, "vault-balance-card").textContent ?? "", BALANCE.toLocaleString())
    ).toBe(1);
    expect(container.textContent).not.toMatch(/net worth/i);
  });

  it("is title, balance, latest unlock, Your Vault, showcase, statement in the DOM, which is the phone order", () => {
    const { container } = render(<VaultDashboardSection />);
    const order = [
      "shell-page-header",
      "vault-balance-card",
      "vault-latest-unlock",
      "vault-holdings",
      "vault-showcase",
      "vault-statement",
    ].map((name) => slot(container, name));
    order.forEach((el) => expect(el).not.toBeNull());
    order.slice(1).forEach((el, i) => expect(follows(order[i]!, el)).toBe(true));
  });

  it("places the desktop grid explicitly while the DOM keeps the phone order", () => {
    const { container } = render(<VaultDashboardSection />);
    const cell = (name: string) => slot(container, name).parentElement!;
    const grid = cell("vault-balance-card").parentElement!;
    expect(grid.className).toContain("lg:grid-cols-3");
    expect(grid.className).toContain("lg:pt-14");
    expect(grid.className).not.toMatch(/(^|\s)pt-/);
    for (const name of [
      "vault-balance-card",
      "vault-latest-unlock",
      "vault-holdings",
      "vault-showcase",
      "vault-statement",
    ])
      expect(cell(name).parentElement).toBe(grid);
    const has = (name: string, ...classes: string[]) =>
      classes.forEach((c) => expect(cell(name).className.split(/\s+/)).toContain(c));
    // Balance and latest unlock side by side on row 1, stretched to one height.
    has("vault-balance-card", "lg:col-start-1", "lg:row-start-1", "lg:self-stretch");
    has("vault-latest-unlock", "lg:col-start-2", "lg:row-start-1", "lg:self-stretch");
    // The showcase sits under both, the Vault column spans both rows, the statement spans the page.
    has("vault-showcase", "lg:col-span-2", "lg:col-start-1", "lg:row-start-2");
    has("vault-holdings", "lg:col-start-3", "lg:row-start-1", "lg:row-span-2");
    has("vault-statement", "lg:col-span-3", "lg:row-start-3");
    // Alone, the balance takes both left columns; beside an unlock it takes one.
    has("vault-balance-card", "lg:col-span-2", "lg:has-[+div:not(:empty)]:col-span-1");
    // The cards fill their cells so the two share a height.
    expect(slot(container, "vault-balance-card").className).toContain("h-full");
    expect(slot(container, "vault-latest-unlock").className).toContain("h-full");
    expect(slot(container, "vault-latest-unlock").firstElementChild!.className).toContain(
      "items-center"
    );
  });

  it("shows the real gallery card tiles in the showcase", () => {
    const { container } = render(<VaultDashboardSection />);
    const tiles = slot(container, "vault-showcase").querySelectorAll(
      '[data-testid="gallery-card"]'
    );
    expect(Array.from(tiles).map((tile) => tile.textContent)).toEqual(["Ostrozava 1st Ed."]);
  });

  it("hides the latest unlock for a player with none", () => {
    mockData.getMySummary = { unlocked: 0, activeTotal: 2, points: 0, rank: null, latest: null };
    const { container } = render(<VaultDashboardSection />);
    expect(slot(container, "vault-latest-unlock")).toBeNull();
    expect(slot(container, "vault-holdings")).not.toBeNull();
    // Its cell stays in the DOM but empty and hidden, so the balance takes both columns.
    const balanceCell = slot(container, "vault-balance-card").parentElement!;
    const unlockCell = balanceCell.nextElementSibling as HTMLElement;
    expect(unlockCell.childElementCount).toBe(0);
    expect(unlockCell.className).toContain("empty:hidden");
  });

  it("has no wiki signal, linked or not; the Lorewards row carries the prompt instead", () => {
    mockData.listWikiLinks = [];
    mockData.getMyTrophies = {
      wikiUsername: null,
      wins: { daily: 0, weekly: 0, monthly: 0 },
      todayRank: null,
    };
    const { container } = render(<VaultDashboardSection />);
    expect(container.querySelector('[data-content="signal"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
    const row = within(slot(container, "vault-holdings")).getByRole("link", { name: /Lorewards/ });
    expect(row.getAttribute("href")).toBe("/settings?tab=account#ixnayid-card");
    expect(row.textContent).toContain("Link your wiki account to take part");
  });

  it("has one primary action: the daily claim, in the Vault column", () => {
    const { container } = render(<VaultDashboardSection />);
    const primary = Array.from(container.querySelectorAll("button, a")).filter((el) =>
      /bg-primary-fill/.test(el.className)
    );
    expect(primary.map((el) => el.textContent)).toEqual(["Claim daily reward"]);
    // In the Vault column, as the first item under the title, not in the Balance card.
    expect(slot(container, "daily-reward-tile").contains(primary[0]!)).toBe(true);
    expect(slot(container, "vault-holdings").contains(primary[0]!)).toBe(true);
    expect(slot(container, "vault-balance-card").contains(primary[0]!)).toBe(false);
  });

  it("shows exactly one Vault title per width: a phone-only header and the column's own title", () => {
    const { container } = render(<VaultDashboardSection />);
    const headings = within(container).getAllByRole("heading", { level: 1, name: "Vault" });
    expect(headings).toHaveLength(2);
    const phone = slot(container, "shell-page-header");
    expect(phone.getAttribute("data-shell-page-header")).toBe("phone");
    expect(phone.className).toContain("lg:hidden");
    expect(phone.contains(headings[0]!)).toBe(true);
    expect(phone.querySelector("span.bg-tint-fill")!.getAttribute("aria-hidden")).toBe("true");
    const own = headings[1]!.closest("[data-shell-page-title]");
    expect(own).not.toBeNull();
    expect(phone.contains(own)).toBe(false);
    // The header carries no toolbar actions, and the Store is only a list row.
    expect(phone.querySelector("button, a")).toBeNull();
    expect(
      within(slot(container, "vault-holdings")).getAllByRole("link", { name: /^Store/ })
    ).toHaveLength(1);
  });

  it("reads no country and no nation data", () => {
    const { container } = render(<VaultDashboardSection />);
    expect(container.textContent).not.toMatch(/country|nation|treasury|yield/i);
    for (const router of ["users", "realms", "countries"])
      expect(mockRouters.has(router)).toBe(false);
  });

  it("nests no block element inside a paragraph anywhere on the page", () => {
    mockData.listWikiLinks = [];
    const { container } = render(<VaultDashboardSection />);
    expect(container.querySelectorAll("p div, span div:not(.texture-overlay)")).toHaveLength(0);
  });
});
