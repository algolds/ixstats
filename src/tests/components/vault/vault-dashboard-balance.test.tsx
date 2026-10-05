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
  useRecentActivity: () => ({ activities: [], loading: false }),
}));
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { error: jest.fn(), dailyBonusClaimed: jest.fn() },
}));
jest.mock("~/components/vault/VaultParticleExplosionModal", () => ({
  VaultParticleExplosionModal: () => null,
}));
jest.mock("~/components/vault/DailyRewardProvider", () => ({ DailyRewardStatus: () => null }));
jest.mock("~/components/vault/sections/dashboard/VaultShowcaseGrid", () => ({
  VaultShowcaseGrid: () => null,
}));

const queryData: Record<string, unknown> = {
  getBalance: { credits: 12345, canClaimDailyBonus: false, loginStreak: 1 },
  getVaultLevel: { vaultLevel: 4 },
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
});
