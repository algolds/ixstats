import React from "react";
import { render, screen } from "@testing-library/react";

const BALANCE = 12345;
const DECK_VALUE = 5000;

jest.mock("~/components/vault/IxCreditsSymbol", () => ({ IxCreditsSymbol: () => <i /> }));
// NumberFlow renders inside a shadow root; render plain text so the figures are countable.
jest.mock("~/components/ui/number-flow", () => ({
  NumberFlowDisplay: ({ value }: { value: number }) => <span>{value.toLocaleString()}</span>,
}));
jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: { id: "user-1" } }) }));
jest.mock("~/hooks/vault/useVaultStats", () => ({
  useVaultStats: () => ({
    loading: false,
    stats: {
      deckValue: 5000,
      totalCards: 12,
      capacityBoost: 10,
      unopenedPacks: 3,
      activeAuctions: 2,
    },
  }),
}));
jest.mock("~/hooks/vault/useRecentActivity", () => ({
  useRecentActivity: () => ({
    loading: false,
    activities: [
      {
        id: "a1",
        type: "EARN_BONUS",
        amount: 5000,
        source: "bonus:new player",
        createdAt: new Date(Date.now() - 3 * 3600 * 1000),
      },
    ],
  }),
}));
jest.mock("~/components/vault/DailyRewardProvider", () => ({
  DailyRewardStatus: () => <button type="button">Daily reward</button>,
}));
jest.mock("~/components/vault/sections/dashboard/VaultShowcaseGrid", () => ({
  VaultShowcaseGrid: () => null,
}));

const queryData: Record<string, unknown> = {
  getBalance: { credits: 12345, canClaimDailyBonus: true, loginStreak: 1 },
  getVaultLevel: { vaultLevel: 4 },
  myNations: { dividendCountryId: "country-1" },
  calculatePassiveIncome: { dailyDividend: 8, weeklyDividend: 7777, monthlyDividend: 33333 },
  getBudgetMultiplier: { percentChange: 2 },
};
const leaf = (name: string) => ({
  useQuery: () => ({ data: queryData[name], isLoading: false, refetch: jest.fn() }),
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
});
jest.mock("~/trpc/react", () => ({
  api: new Proxy(
    {},
    {
      get: () => new Proxy({}, { get: (_target, name: string) => leaf(name) }),
    }
  ),
}));

import { VaultDashboardSection } from "~/components/vault/sections/VaultDashboardSection";

const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe("Vault dashboard", () => {
  it("shows the IxCredits balance once, in the Wallet card", () => {
    const { container } = render(<VaultDashboardSection />);
    expect(occurrences(container.textContent ?? "", BALANCE.toLocaleString())).toBe(1);
    const wallet = screen.getByText("Wallet").closest(".facet-pane");
    expect(wallet?.textContent).toContain(BALANCE.toLocaleString());
  });

  it("gives the Collection card deck value, net worth and the counts", () => {
    render(<VaultDashboardSection />);
    const collection = screen.getByText("Collection").closest(".facet-pane") as HTMLElement;
    const text = collection.textContent ?? "";
    expect(text).toContain(DECK_VALUE.toLocaleString());
    expect(text).toContain((BALANCE + DECK_VALUE).toLocaleString());
    expect(text).toContain("Net worth");
    expect(text).toContain("Card deck value");
    expect(text).toContain("Tier 4 account");
    expect(text).toContain("12 / 160");
    expect(text).toMatch(/Packs:\s*3/);
    expect(text).toMatch(/Auctions:\s*2/);
    expect(text).not.toContain("Available balance");
  });

  it("keeps treasury revenue in the yields card, not the Wallet", () => {
    const { container } = render(<VaultDashboardSection />);
    const wallet = screen.getByText("Wallet").closest(".facet-pane") as HTMLElement;
    expect(wallet.textContent).not.toContain("Treasury revenue");
    expect(wallet.textContent).not.toContain("7,777");
    expect(occurrences(container.textContent ?? "", "7,777")).toBe(1);
    expect(occurrences(container.textContent ?? "", "33,333")).toBe(1);
  });

  it("has one daily claim control, the Wallet's daily reward", () => {
    render(<VaultDashboardSection />);
    expect(screen.queryByRole("button", { name: /claim daily bonus/i })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Daily reward" })).toHaveLength(1);
  });

  it("labels recent activity in words with a relative time", () => {
    render(<VaultDashboardSection />);
    expect(screen.getByText("New player bonus")).not.toBeNull();
    expect(screen.queryByText(/bonus:new/)).toBeNull();
    expect(screen.getByText("3h ago")).not.toBeNull();
  });
});
