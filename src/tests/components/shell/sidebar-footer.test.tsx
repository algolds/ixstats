import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { BUILD_VERSION } from "~/lib/buildVersion";

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
let wikiLinks:
  { source: string; username: string; verified: boolean; pending: boolean }[] | undefined = [
  { source: "ixwiki", username: "Diplomat", verified: true, pending: false },
];

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
    ixnayid: { listWikiLinks: { useQuery: () => ({ data: wikiLinks }) } },
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
  wikiLinks = [{ source: "ixwiki", username: "Diplomat", verified: true, pending: false }];
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

  it("keeps the reward control outside the link (no nested interactive elements)", () => {
    render(<SidebarVaultCard expanded={false} onToggle={() => undefined} />);
    const link = screen.getByRole("link", { name: /IxCredits/ });
    expect(within(link).queryByRole("button")).toBeNull();
  });

  it("omits earnings when there are none today", () => {
    earnings = { total: 0, sources: [] };
    render(<SidebarVaultCard expanded={false} onToggle={() => undefined} />);
    expect(screen.getByRole("link", { name: /IxCredits/ })).not.toHaveTextContent("today");
  });

  it("renders nothing while the balance loads, so the footer does not jump", () => {
    balance = { data: undefined, isLoading: true };
    const { container } = render(<SidebarVaultCard expanded={false} onToggle={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
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

  it("keeps the details out of the closed card", () => {
    open({ expanded: false });
    expect(screen.queryByRole("link", { name: "Cards" })).toBeNull();
    expect(screen.queryByText(/unlocked/)).toBeNull();
  });

  it("lists each earning source for today", () => {
    earnings = {
      total: 400,
      sources: [
        { type: "daily", label: "Daily login", amount: 250 },
        { type: "wiki", label: "Wiki contributions", amount: 150 },
      ],
    };
    open();
    expect(screen.getByText("Daily login")).toBeInTheDocument();
    expect(screen.getByText("Wiki contributions")).toBeInTheDocument();
    expect(screen.getByText("+150")).toBeInTheDocument();
  });

  it("says so when nothing has been earned today", () => {
    earnings = { total: 0, sources: [] };
    open();
    expect(screen.getByText("Nothing earned yet today")).toBeInTheDocument();
  });

  it("shows achievement progress, points and rank", () => {
    open();
    expect(screen.getByText("12 of 80 unlocked")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "12");
    expect(screen.getByText(/340 points/)).toBeInTheDocument();
    expect(screen.getByText(/Rank 7/)).toBeInTheDocument();
  });

  it("omits the rank for a player who has not ranked yet", () => {
    summary = { unlocked: 0, activeTotal: 80, points: 0, rank: null };
    open();
    expect(screen.queryByText(/Rank/)).toBeNull();
  });

  it("never offers a closest-to-unlocking list, a dividend or a yield", () => {
    open();
    expect(screen.queryByText(/closest/i)).toBeNull();
    expect(screen.queryByText(/dividend|yield|interest/i)).toBeNull();
  });

  it("links into the Vault", () => {
    open();
    expect(screen.getByRole("link", { name: "Cards" })).toHaveAttribute("href", "/vault/cards");
    expect(screen.getByRole("link", { name: "Store" })).toHaveAttribute("href", "/vault/store");
    expect(screen.getByRole("link", { name: "Achievements" })).toHaveAttribute(
      "href",
      "/vault/achievements"
    );
  });

  it("asks to link a wiki account only when none is verified", () => {
    wikiLinks = [{ source: "ixwiki", username: "Diplomat", verified: false, pending: true }];
    open();
    expect(
      screen.getByRole("link", { name: "Link your wiki account to earn from edits" })
    ).toHaveAttribute("href", "/settings?tab=account");
  });

  it("treats a verified link to another wiki as no ixwiki link", () => {
    wikiLinks = [{ source: "iiwiki", username: "Diplomat", verified: true, pending: false }];
    open();
    expect(screen.getByRole("link", { name: /Link your wiki account/ })).toBeInTheDocument();
  });

  it("does not nag with a verified link, or before the links have loaded", () => {
    open();
    expect(screen.queryByText(/Link your wiki account/)).toBeNull();
    wikiLinks = undefined;
    cleanup();
    open();
    expect(screen.queryByText(/Link your wiki account/)).toBeNull();
  });

  it("renders nothing without a balance, open or closed", () => {
    balance = { data: undefined, isLoading: true };
    const { container } = open();
    expect(container).toBeEmptyDOMElement();
  });
});

describe("SidebarFooterLinks", () => {
  it("links the version and build to the changelog, then Privacy and Terms", () => {
    render(<SidebarFooterLinks signedIn />);
    const version = screen.getByRole("link", { name: new RegExp(BUILD_VERSION) });
    expect(version).toHaveAttribute("href", "/changelog");
    expect(version).toHaveTextContent(/^v\d+\.\d+\.\d+/);
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  });

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

  it("puts the vault card above the account row and the footer links below the collapse button", () => {
    const { panel } = renderSidebar();
    const card = screen.getByTestId("vault-card");
    const account = screen.getByRole("button", { name: "Account: diplomat" });
    const collapse = screen.getByRole("button", { name: "Collapse sidebar" });
    const privacy = screen.getByRole("link", { name: "Privacy" });
    const follows = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(panel).toContainElement(card);
    expect(follows(card, account)).toBe(true);
    expect(follows(account, collapse)).toBe(true);
    expect(follows(collapse, privacy)).toBe(true);
  });

  it("renders no card and no feedback signed out", () => {
    renderSidebar({ signedIn: false, vaultCard: undefined });
    expect(screen.queryByTestId("vault-card")).toBeNull();
    expect(screen.queryByRole("button", { name: "Feedback" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Wallet" })).toBeNull();
  });

  describe("collapsed rail wallet", () => {
    it("is a Vault link above the account row, without a dot by default", () => {
      renderSidebar({ collapsed: true });
      const wallet = screen.getByRole("link", { name: "Wallet" });
      expect(wallet).toHaveAttribute("href", "/vault");
      const account = screen.getByRole("button", { name: "Account: diplomat" });
      expect(
        wallet.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(within(wallet).queryByRole("img", { name: "Daily reward ready" })).toBeNull();
    });

    it("carries a dot while a reward is claimable", () => {
      renderSidebar({
        collapsed: true,
        badges: { "daily-reward": { kind: "action", label: "3d" } },
      });
      const wallet = screen.getByRole("link", { name: "Wallet" });
      expect(within(wallet).getByRole("img", { name: "Daily reward ready" })).toBeInTheDocument();
    });

    it("is not rendered signed out", () => {
      renderSidebar({
        collapsed: true,
        signedIn: false,
        vaultCard: undefined,
        apps: getVisibleApps({ signedIn: false, isAdmin: false }),
      });
      expect(screen.queryByRole("link", { name: "Wallet" })).toBeNull();
    });

    it("is rendered for a signed-in user whatever the navigation settings hide", () => {
      renderSidebar({
        collapsed: true,
        apps: getVisibleApps({
          signedIn: true,
          isAdmin: false,
          navigationSettings: { showWikiTab: false, showLabsTab: false, showMapsTab: false },
        }),
      });
      expect(screen.getByRole("link", { name: "Wallet" })).toHaveAttribute("href", "/vault");
    });

    it("does not depend on the app list", () => {
      renderSidebar({ collapsed: true, apps: [] });
      expect(screen.getByRole("link", { name: "Wallet" })).toHaveAttribute("href", "/vault");
    });
  });
});
