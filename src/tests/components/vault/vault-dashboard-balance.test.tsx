import React from "react";
import { render } from "@testing-library/react";

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
// The statement and the showcase have their own suites; their rows would repeat figures.
jest.mock("~/components/vault/sections/dashboard/VaultStatement", () => ({
  VaultStatement: () => <section data-slot="vault-statement" />,
}));
jest.mock("~/components/vault/sections/dashboard/VaultShowcase", () => ({
  VaultShowcase: () => <section data-slot="vault-showcase" />,
}));
jest.mock("~/hooks/vault/useVaultStats", () => ({
  useVaultStats: () => ({
    loading: false,
    error: false,
    stats: { deckValue: 5000, totalCards: 12 },
  }),
}));

const mockRouters = new Set<string>();
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
const slot = (container: HTMLElement, name: string) =>
  container.querySelector(`[data-slot="${name}"]`) as HTMLElement;
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
      listStoreItems: [],
      getPurchasedItems: { purchasedItemIds: [], purchaseCounts: {} },
      listWikiLinks: [{ source: "ixwiki", username: "Ixnay", verified: true, pending: false }],
    });
  });

  it("shows the IxCredits balance only in the balance card: its lead figure and the credits share of net worth", () => {
    const { container } = render(<VaultDashboardSection />);
    expect(occurrences(container.textContent ?? "", BALANCE.toLocaleString())).toBe(2);
    expect(
      occurrences(slot(container, "vault-balance-card").textContent ?? "", BALANCE.toLocaleString())
    ).toBe(2);
  });

  it("is title, balance, showcase, Your Vault, latest unlock, statement in the DOM, which is the phone order", () => {
    const { container } = render(<VaultDashboardSection />);
    const order = [
      "shell-page-header",
      "vault-balance-card",
      "vault-showcase",
      "vault-holdings",
      "vault-latest-unlock",
      "vault-statement",
    ].map((name) => slot(container, name));
    order.forEach((el) => expect(el).not.toBeNull());
    order.slice(1).forEach((el, i) => expect(follows(order[i]!, el)).toBe(true));
  });

  it("puts the statement in the left two thirds and the Vault list and latest unlock in the right column from lg", () => {
    const { container } = render(<VaultDashboardSection />);
    const column = slot(container, "vault-holdings").parentElement!;
    expect(column.className).toContain("lg:col-start-3");
    expect(slot(container, "vault-latest-unlock").parentElement).toBe(column);
    const statement = slot(container, "vault-statement").parentElement!;
    expect(statement.className).toContain("lg:col-span-2");
    expect(statement.className).toContain("lg:col-start-1");
    expect(statement.className).toContain(
      column.className.match(/lg:row-start-\d+/)?.[0] ?? "no-row"
    );
  });

  it("hides the latest unlock for a player with none", () => {
    mockData.getMySummary = { unlocked: 0, activeTotal: 2, points: 0, rank: null, latest: null };
    const { container } = render(<VaultDashboardSection />);
    expect(slot(container, "vault-latest-unlock")).toBeNull();
    expect(slot(container, "vault-holdings")).not.toBeNull();
  });

  it("shows the wiki signal above the balance only while no wiki link is verified", () => {
    const { container, unmount } = render(<VaultDashboardSection />);
    expect(container.querySelector('[data-content="signal"]')).toBeNull();
    unmount();

    mockData.listWikiLinks = [];
    const unlinked = render(<VaultDashboardSection />);
    const signal = unlinked.container.querySelector('[data-content="signal"]')!;
    expect(signal).not.toBeNull();
    expect(follows(signal, slot(unlinked.container, "vault-balance-card"))).toBe(true);
    expect(follows(slot(unlinked.container, "shell-page-header"), signal)).toBe(true);
  });

  it("has one primary action: the daily claim", () => {
    const { container } = render(<VaultDashboardSection />);
    const primary = Array.from(container.querySelectorAll("button, a")).filter((el) =>
      /bg-primary-fill/.test(el.className)
    );
    expect(primary.map((el) => el.textContent)).toEqual(["Claim daily reward"]);
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
    expect(container.querySelectorAll("p div")).toHaveLength(0);
  });
});
