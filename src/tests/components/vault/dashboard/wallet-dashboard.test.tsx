import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/hooks/vault/useVaultStats", () => ({
  useVaultStats: jest.fn(),
}));

jest.mock("~/hooks/useCardSheet", () => ({
  useCardSheet: () => ({ open: jest.fn(), close: jest.fn() }),
}));

jest.mock("~/components/vault/DailyRewardProvider", () => ({
  useDailyReward: () => ({ open: jest.fn() }),
}));

jest.mock("~/components/ui/number-flow", () => ({
  NumberFlowDisplay: ({ value }: { value: number }) => <span>{value.toLocaleString("en-US")}</span>,
}));

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(),
    vault: {
      getBalance: { useQuery: jest.fn() },
      getVaultLevel: { useQuery: jest.fn() },
      getTodayEarnings: { useQuery: jest.fn() },
      getTransactions: { useQuery: jest.fn() },
    },
    achievements: {
      getMySummary: { useQuery: jest.fn() },
      getNextUnlock: { useQuery: jest.fn() },
    },
    cards: {
      getMyDisplay: { useQuery: jest.fn() },
    },
    cardPacks: {
      getMyPacks: { useQuery: jest.fn() },
    },
  },
}));

import { api } from "~/trpc/react";
import { useVaultStats } from "~/hooks/vault/useVaultStats";
import { VaultDashboardSection } from "~/components/vault/sections/VaultDashboardSection";

describe("Wallet Dashboard (/vault, Facet 5 + Apple Wallet)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    class MockIntersectionObserver {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    window.IntersectionObserver = MockIntersectionObserver;
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    jest.mocked(useVaultStats).mockReturnValue({
      stats: { totalCards: 12, deckValue: 8500 },
      loading: false,
      error: null,
    } as never);

    jest.mocked(api.useUtils).mockReturnValue({
      vault: {
        getTransactions: { fetch: jest.fn() },
      },
    } as never);

    jest.mocked(api.vault.getBalance.useQuery).mockReturnValue({
      data: {
        credits: 4200,
        loginStreak: 5,
        canClaimDailyBonus: true,
      },
      isLoading: false,
      isError: false,
    } as never);

    jest.mocked(api.vault.getVaultLevel.useQuery).mockReturnValue({
      data: { vaultLevel: 4 },
    } as never);

    jest.mocked(api.vault.getTodayEarnings.useQuery).mockReturnValue({
      data: { total: 350 },
    } as never);

    jest.mocked(api.achievements.getMySummary.useQuery).mockReturnValue({
      data: {
        recent: [
          {
            key: "first-mint",
            title: "First Mint",
            rarity: "Rare",
            category: "collection",
            iconUrl: null,
            reward: 100,
          },
        ],
      },
    } as never);

    jest.mocked(api.achievements.getNextUnlock.useQuery).mockReturnValue({
      data: null,
    } as never);

    jest.mocked(api.cards.getMyDisplay.useQuery).mockReturnValue({
      data: {
        showcase: null,
        faces: [
          {
            cardId: "card-1",
            title: "Sovereign Charter",
            rarity: "RARE",
            cardType: "LORE",
            realm: {
              id: "realm-default",
              slug: "ixworld",
              name: "IxWorld",
              crestUrl: null,
              isSystem: true,
            },
            artwork: null,
            uncollected: false,
            number: 1,
            season: 1,
            isRetired: false,
            copy: {
              ownershipId: "own-1",
              finish: "STANDARD",
              serialNumber: 12,
              level: 1,
            },
          },
        ],
      },
      isLoading: false,
      isError: false,
    } as never);

    jest.mocked(api.cardPacks.getMyPacks.useQuery).mockReturnValue({
      data: {
        packs: [
          {
            id: "pack-wait-1",
            pack: {
              name: "Realm Booster",
              packType: "PREMIUM",
              guaranteedRarity: "RARE",
              artwork: null,
            },
          },
        ],
      },
      isLoading: false,
      isError: false,
    } as never);

    jest.mocked(api.vault.getTransactions.useQuery).mockReturnValue({
      data: {
        transactions: [
          {
            id: "tx-1",
            createdAt: new Date("2026-11-14T14:30:00.000Z"),
            credits: 350,
            balanceAfter: 4200,
            type: "EARN",
            source: "DAILY_LOGIN_CREDITS",
            metadata: null,
          },
          {
            id: "tx-2",
            createdAt: new Date("2026-11-14T09:15:00.000Z"),
            credits: -500,
            balanceAfter: 3850,
            type: "SPEND",
            source: "PACK_PURCHASE",
            metadata: null,
          },
        ],
        hasMore: false,
      },
      isLoading: false,
      isError: false,
    } as never);
  });

  it("renders the Wallet header, net-worth Lens hero without chevron noise, pass shelf, and bank statement with zero duplicate Holdings nav", () => {
    render(<VaultDashboardSection />);

    // PageHeader is titled "Wallet" with StreakPill and no duplicate Your Vault / Holdings rail
    expect(screen.getByRole("heading", { level: 1, name: "Wallet" })).toBeVisible();
    expect(document.querySelector("[data-slot='streak-pill']")).toBeInTheDocument();
    expect(document.querySelector("[data-slot='vault-holdings']")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /your vault/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Import deck")).not.toBeInTheDocument();

    // Balance & Net Worth Hero on LensCard without chevron TextureOverlay
    const balanceCard = document.querySelector("[data-slot='vault-balance-card']") as HTMLElement;
    expect(balanceCard).toBeInTheDocument();
    expect(balanceCard.querySelector("[data-texture='chevron']")).not.toBeInTheDocument();
    expect(within(balanceCard).getByText("4,200")).toBeVisible();
    expect(within(balanceCard).getByText("Level 4 collector")).toBeVisible();
    expect(within(balanceCard).getByText("+350 today")).toBeVisible();
    expect(within(balanceCard).getByText("Card deck value")).toBeVisible();
    expect(within(balanceCard).getByText("12 cards")).toBeVisible();
    expect(within(balanceCard).getByText("8,500")).toBeVisible();
    expect(within(balanceCard).getByText("Total net worth")).toBeVisible();
    expect(within(balanceCard).getByText("12,700")).toBeVisible();

    // 1-tap DailyRewardTile embedded when claimable
    expect(within(balanceCard).getByText("Daily reward ready")).toBeInTheDocument();
    expect(
      within(balanceCard).getByRole("button", { name: "Claim daily reward" })
    ).toBeInTheDocument();

    // Showcase pass shelf with CardFace, waiting pack tile, and "Open my cards" link
    const showcase = document.querySelector("[data-slot='vault-showcase']") as HTMLElement;
    expect(within(showcase).getByRole("link", { name: "Open my cards" })).toHaveAttribute(
      "href",
      "/vault/cards/mine"
    );
    expect(within(showcase).getByText("1 pack waiting")).toBeInTheDocument();

    // Full-width bank statement (`padding="none"`) with filter pills, source icons, timestamps, and figures
    const statement = document.querySelector("[data-slot='vault-statement']") as HTMLElement;
    expect(statement).toBeInTheDocument();
    expect(statement).not.toHaveClass("p-4");
    expect(within(statement).getByText("14:30 UTC")).toBeInTheDocument();
    expect(within(statement).getByText("09:15 UTC")).toBeInTheDocument();
    expect(statement.querySelectorAll("[data-slot='statement-icon']")).toHaveLength(2);

    // Filter pills switch statement query direction
    fireEvent.click(within(statement).getByRole("radio", { name: "Earned" }));
    expect(api.vault.getTransactions.useQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ direction: "earned" })
    );

    expect(screen.queryByText(/unlock/i)).not.toBeInTheDocument();
  });

  it("omits the embedded daily reward prompt inside VaultBalanceCard when today's reward was already claimed", () => {
    jest.mocked(api.vault.getBalance.useQuery).mockReturnValue({
      data: {
        credits: 4200,
        loginStreak: 5,
        canClaimDailyBonus: false,
      },
      isLoading: false,
      isError: false,
    } as never);

    render(<VaultDashboardSection />);

    const balanceCard = document.querySelector("[data-slot='vault-balance-card']") as HTMLElement;
    expect(within(balanceCard).queryByText("Daily reward ready")).not.toBeInTheDocument();
  });
});
