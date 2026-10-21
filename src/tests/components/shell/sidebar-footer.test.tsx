import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
type Balance = { credits: number; canClaimDailyBonus: boolean; loginStreak: number };
let balance: { data: Balance | undefined; isLoading: boolean } = {
  data: { credits: 12345, canClaimDailyBonus: false, loginStreak: 3 },
  isLoading: false,
};
let earnings:
  { total: number; sources: { type: string; label: string; amount: number }[] } | undefined = {
  total: 250,
  sources: [{ type: "daily", label: "Daily", amount: 250 }],
};
const earningsQuery = jest.fn();
let summary:
  { unlocked: number; activeTotal: number; points: number; rank: number | null } | undefined = {
  unlocked: 12,
  activeTotal: 80,
  points: 340,
  rank: 7,
};

jest.mock("@clerk/nextjs", () => ({ useAuth: () => ({ userId: "u1" }) }));
jest.mock("~/trpc/react", () => ({
  api: {
    vault: {
      getBalance: { useQuery: () => balance },
      getTodayEarnings: {
        useQuery: (input: unknown, opts: unknown) => {
          earningsQuery(input, opts);
          return { data: earnings };
        },
      },
    },
    achievements: { getMySummary: { useQuery: () => ({ data: summary }) } },
  },
}));
jest.mock("~/components/vault/DailyRewardProvider", () => ({
  DailyRewardStatus: () => <button type="button">Daily reward</button>,
}));
jest.mock("~/components/vault/IxCreditsSymbol", () => ({ IxCreditsSymbol: () => <i /> }));
jest.mock("~/components/shell/FeedbackModal", () => ({
  FeedbackModal: ({ onClose }: { onClose: () => void }) => (
    <form aria-label="Send feedback">
      <button type="button" onClick={onClose}>
        Cancel
      </button>
    </form>
  ),
}));

import { SidebarVaultCard } from "~/components/shell/SidebarVaultCard";
import { SidebarFooterLinks } from "~/components/shell/SidebarFooterLinks";
import { AppSidebar } from "~/components/shell/AppSidebar";
import { getVisibleApps } from "~/lib/navigation/app-sections";

beforeEach(() => {
  balance = {
    data: { credits: 12345, canClaimDailyBonus: false, loginStreak: 3 },
    isLoading: false,
  };
  earnings = { total: 250, sources: [{ type: "daily", label: "Daily", amount: 250 }] };
  earningsQuery.mockClear();
  summary = { unlocked: 12, activeTotal: 80, points: 340, rank: 7 };
});

describe("SidebarVaultCard", () => {
  it("shows the balance, today's earnings and the daily reward, linking to the Vault", () => {
    const { container } = render(<SidebarVaultCard expanded={false} onToggle={() => undefined} />);
    const link = screen.getByRole("link", { name: /IxCredits/ });
    expect(link).toHaveAttribute("href", "/vault");
    expect(link).toHaveTextContent("12,345");
    expect(link).toHaveTextContent("+250 today");
    expect(screen.getByRole("button", { name: "Daily reward" })).toBeInTheDocument();
    // A solid well inside the chrome glass, never a glass pane.
    expect(container.querySelector('[data-slot="sidebar-vault-card"]')).toHaveClass("facet-well");
  });
});

describe("SidebarVaultCard disclosure", () => {
  const open = (props: { expanded?: boolean; onToggle?: () => void } = {}) =>
    render(
      <SidebarVaultCard
        expanded={props.expanded ?? true}
        onToggle={props.onToggle ?? (() => undefined)}
      />
    );

  it("has a chevron button that reports its state and toggles the card", () => {
    const onToggle = jest.fn();
    const { rerender } = open({ expanded: false, onToggle });
    const chevron = screen.getByRole("button", { name: /earnings and progress/i });
    expect(chevron).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(chevron);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<SidebarVaultCard expanded onToggle={onToggle} />);
    expect(screen.getByRole("button", { name: /earnings and progress/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });
});

describe("SidebarFooterLinks", () => {
  it("opens the feedback form from Feedback and closes it again", async () => {
    render(<SidebarFooterLinks signedIn />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Feedback" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("form", { name: "Send feedback" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("hides Feedback when signed out (the endpoint needs a session)", () => {
    render(<SidebarFooterLinks signedIn={false} />);
    expect(screen.queryByRole("button", { name: "Feedback" })).toBeNull();
    expect(screen.getByRole("link", { name: "Privacy" })).toBeInTheDocument();
  });
});

describe("AppSidebar footer", () => {
  const apps = getVisibleApps({ signedIn: true, isAdmin: false });
  function renderSidebar(props: Partial<React.ComponentProps<typeof AppSidebar>> = {}) {
    const utils = render(
      <AppSidebar
        pathname="/mycountry/economy"
        searchParams={null}
        apps={apps}
        collapsed={false}
        onCollapsedChange={() => undefined}
        account={<button type="button">Account: diplomat</button>}
        expanded={new Set()}
        onToggle={() => undefined}
        badges={{}}
        signedIn
        vaultCard={<div data-testid="vault-card" />}
        {...props}
      />
    );
    const panel = utils.container.querySelector<HTMLElement>('[data-slot="app-sidebar-panel"]')!;
    return { ...utils, panel };
  }

  it("renders no card and no feedback signed out", () => {
    renderSidebar({ signedIn: false, vaultCard: undefined });
    expect(screen.queryByTestId("vault-card")).toBeNull();
    expect(screen.queryByRole("button", { name: "Feedback" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Wallet" })).toBeNull();
  });

  describe("collapsed rail wallet", () => {
    it("is not rendered signed out", () => {
      renderSidebar({
        collapsed: true,
        signedIn: false,
        vaultCard: undefined,
        apps: getVisibleApps({ signedIn: false, isAdmin: false }),
      });
      expect(screen.queryByRole("link", { name: "Wallet" })).toBeNull();
    });
  });
});
