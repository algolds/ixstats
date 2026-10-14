import React from "react";
import { render } from "@testing-library/react";

const BALANCE = 12345;

jest.mock("~/components/vault/IxCreditsSymbol", () => ({ IxCreditsSymbol: () => <i /> }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
jest.mock("~/components/vault/DailyRewardProvider", () => ({
  useDailyReward: () => ({ open: jest.fn() }),
}));
// The statement has its own suite; its rows would repeat the balance as running totals.
jest.mock("~/components/vault/sections/dashboard/VaultStatement", () => ({
  VaultStatement: () => <section data-slot="vault-statement" />,
}));
jest.mock("~/hooks/vault/useVaultStats", () => ({
  useVaultStats: () => ({
    loading: false,
    error: false,
    stats: { deckValue: 5000, totalCards: 12, unopenedPacks: 3 },
  }),
}));

const mockRouters = new Set<string>();
const mockData: Record<string, unknown> = {
  getBalance: { credits: 12345, canClaimDailyBonus: true, loginStreak: 1 },
  getVaultLevel: { vaultLevel: 4 },
  getTodayEarnings: { total: 0, sources: [], transactionCount: 0 },
  getMySummary: { unlocked: 1, activeTotal: 2, points: 3, rank: 4 },
  listStoreItems: [],
  getPurchasedItems: { purchasedItemIds: [], purchaseCounts: {} },
  listWikiLinks: [],
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

describe("Vault Wallet page", () => {
  beforeEach(() => mockRouters.clear());

  it("shows the IxCredits balance once, in the account hero", () => {
    const { container } = render(<VaultDashboardSection />);
    expect(occurrences(container.textContent ?? "", BALANCE.toLocaleString())).toBe(1);
    const hero = container.querySelector('[data-slot="vault-account-hero"]');
    expect(hero?.textContent).toContain(BALANCE.toLocaleString());
  });

  it("is hero, holdings, statement in the DOM, which is the phone order", () => {
    const { container } = render(<VaultDashboardSection />);
    const slots = ["vault-account-hero", "vault-holdings", "vault-statement"].map((slot) =>
      container.querySelector(`[data-slot="${slot}"]`)
    );
    slots.forEach((el) => expect(el).not.toBeNull());
    const [hero, holdings, statement] = slots as Element[];
    expect(
      hero!.compareDocumentPosition(holdings!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      holdings!.compareDocumentPosition(statement!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("puts the holdings in two columns on a phone and the statement beside them from lg", () => {
    const { container } = render(<VaultDashboardSection />);
    const holdings = container.querySelector('[data-slot="vault-holdings"]');
    expect(holdings?.className).toContain("grid-cols-2");
    expect(holdings?.className).toContain("lg:grid-cols-1");
    expect(holdings?.parentElement?.className).toContain("lg:col-start-3");
    const statement = container.querySelector('[data-slot="vault-statement"]');
    expect(statement?.parentElement?.className).toContain("lg:col-span-2");
  });

  it("reads no country and no nation data", () => {
    const { container } = render(<VaultDashboardSection />);
    expect(container.textContent).not.toMatch(/country|nation|treasury|yield/i);
    for (const router of ["users", "realms", "countries"])
      expect(mockRouters.has(router)).toBe(false);
  });
});
