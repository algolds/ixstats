import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("@clerk/nextjs", () => ({
  useAuth: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
}));

jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));

jest.mock("~/components/shared/country-actions/CountryActionsProvider", () => ({
  useOpenCountryActions: () => jest.fn(),
}));

jest.mock("~/components/ui/number-flow", () => ({
  NumberFlowDisplay: ({ value }: { value: number }) => <span>{value.toLocaleString("en-US")}</span>,
}));

jest.mock("~/components/vault/daily-reward/DailyRewardDialog", () => ({
  DailyRewardDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="daily-reward-dialog">Daily reward open</div> : null,
}));

jest.mock("~/trpc/react", () => ({
  api: {
    vault: {
      getBalance: { useQuery: jest.fn() },
      getTodayEarnings: { useQuery: jest.fn() },
    },
    achievements: {
      getMySummary: { useQuery: jest.fn() },
    },
  },
}));

import { useAuth } from "@clerk/nextjs";
import { TooltipProvider } from "~/components/ui/tooltip";
import { SystemContextMenuProvider } from "~/components/shared/context-menu/SystemContextMenu";
import { AppSidebar } from "~/components/shell/AppSidebar";
import { SidebarVaultCard } from "~/components/shell/SidebarVaultCard";
import { DailyRewardProvider } from "~/components/vault/DailyRewardProvider";
import { getApp } from "~/lib/navigation/app-sections";
import { api } from "~/trpc/react";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});

describe("SidebarVaultCard single-line well & AppSidebar context menu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({ userId: "user-1" } as never);
  });

  it("renders a single-line facet-well strip with credits, +today delta, inline Claim pill, and a Popover breakdown without duplicate Vault links", () => {
    jest.mocked(api.vault.getBalance.useQuery).mockReturnValue({
      data: { credits: 14250, canClaimDailyBonus: true },
      isLoading: false,
    } as never);
    jest.mocked(api.vault.getTodayEarnings.useQuery).mockReturnValue({
      data: {
        total: 120,
        sources: [{ type: "daily", label: "Daily login", amount: 120 }],
      },
    } as never);
    jest.mocked(api.achievements.getMySummary.useQuery).mockReturnValue({
      data: { unlocked: 18, activeTotal: 40, points: 950, rank: 7 },
    } as never);

    render(
      <DailyRewardProvider autoOpen={false}>
        <SidebarVaultCard />
      </DailyRewardProvider>
    );

    const card = document.querySelector("[data-slot='sidebar-vault-card']")!;
    expect(card).toHaveClass("facet-well", "rounded-row");
    expect(card).toHaveAttribute("data-app", "vault");

    const walletLink = screen.getByRole("link", { name: "Wallet: 14,250 IxCredits" });
    expect(walletLink).toHaveAttribute("href", "/vault");
    expect(screen.getByText("+120")).toBeInTheDocument();

    const claimPill = screen.getByRole("button", { name: "Claim daily reward" });
    expect(claimPill).toHaveClass("facet-gold");
    fireEvent.click(claimPill);
    expect(screen.getByTestId("daily-reward-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show earnings and progress" }));
    expect(screen.getByText("Today's earnings")).toBeInTheDocument();
    expect(screen.getByText("Daily login")).toBeInTheDocument();
    expect(screen.getByText("18 of 40")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cards" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Store" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Achievements" })).toBeNull();
  });

  it("hides the inline Claim pill once today's daily reward has been claimed", () => {
    jest.mocked(api.vault.getBalance.useQuery).mockReturnValue({
      data: { credits: 5000, canClaimDailyBonus: false },
      isLoading: false,
    } as never);
    jest.mocked(api.vault.getTodayEarnings.useQuery).mockReturnValue({
      data: { total: 0, sources: [] },
    } as never);

    render(
      <DailyRewardProvider autoOpen={false}>
        <SidebarVaultCard />
      </DailyRewardProvider>
    );

    expect(screen.queryByRole("button", { name: "Claim daily reward" })).toBeNull();
  });

  it("contributes Collapse sidebar, Search & commands, and Quick settings to SystemContextMenu on right-click", () => {
    const onCollapsedChange = jest.fn();
    const haloEvents: Array<string> = [];
    const onHaloEvent = (event: Event) => {
      haloEvents.push((event as CustomEvent<string>).detail);
    };
    window.addEventListener("ix:open-halo-mode", onHaloEvent);

    const { container } = render(
      <SystemContextMenuProvider>
        <TooltipProvider>
          <AppSidebar
            pathname="/vault"
            searchParams={null}
            apps={[getApp("vault")]}
            collapsed={false}
            onCollapsedChange={onCollapsedChange}
            expanded={new Set()}
            onToggle={() => {}}
            badges={{}}
          />
        </TooltipProvider>
      </SystemContextMenuProvider>
    );

    const aside = container.querySelector("#facet-app-sidebar")!;
    fireEvent.contextMenu(aside, { clientX: 40, clientY: 120 });

    expect(screen.getByRole("menuitem", { name: /Collapse sidebar/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Search & commands/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: /Quick settings/i }));

    expect(haloEvents).toEqual(["settings"]);
    window.removeEventListener("ix:open-halo-mode", onHaloEvent);
  });
});
