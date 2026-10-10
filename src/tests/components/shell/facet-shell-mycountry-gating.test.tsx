import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

let premium = false;
let betaTester = false;
let navSettings: { showCardsTab?: boolean } | undefined;
let navFlags: { realmMember: boolean; forumModerator: boolean } | undefined;

jest.mock("next/navigation", () => ({
  usePathname: () => "/mycountry",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));
jest.mock("@clerk/nextjs", () => ({ useAuth: () => ({ userId: "shell-user" }) }));
jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: { id: "shell-user" } }) }));
jest.mock("~/hooks/usePermissions", () => ({
  useHasPermission: () => false,
  useHasRoleLevel: () => false,
  useIsBetaTester: () => betaTester,
}));
jest.mock("~/components/providers/AbilityProvider", () => ({
  useAbility: () => ({
    can: (action: string, subject: string, field?: string) =>
      premium && action === "access" && subject === "MyCountryFeature" && field === "defense",
  }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      vault: { getBalance: { invalidate: jest.fn() } },
      cards: { getMyCards: { invalidate: jest.fn() } },
    }),
    admin: { getNavigationSettings: { useQuery: () => ({ data: navSettings }) } },
    thinkpagesForum: { navFlags: { useQuery: () => ({ data: navFlags }) } },
    vault: {
      getBalance: {
        useQuery: () => ({
          data: { credits: 500, canClaimDailyBonus: false, loginStreak: 1 },
          isLoading: false,
        }),
      },
      getTodayEarnings: { useQuery: () => ({ data: undefined }) },
      claimCombinedDailyClaim: { useMutation: () => ({ mutate: jest.fn() }) },
    },
  },
}));
jest.mock("~/components/shell/use-nav-badges", () => ({ useNavBadges: () => ({}) }));
jest.mock("~/components/shell/AccountMenu", () => ({ AccountMenu: () => null }));
jest.mock("~/components/shell/ShellHalo", () => ({ ShellHalo: () => null }));
jest.mock("~/lib/sound/cuelume", () => ({ soundCues: {}, soundEffects: {} }));
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { error: jest.fn(), success: jest.fn() },
}));
jest.mock("~/components/cards/display/CardHolographicCover", () => ({
  CardHolographicCover: () => null,
}));

import { AppShell } from "~/components/shell/AppShell";

function sidebarLinks() {
  render(
    <AppShell>
      <p>Page</p>
    </AppShell>
  );
  return within(screen.getByRole("navigation", { name: "App navigation" }));
}

beforeEach(() => {
  premium = false;
  betaTester = false;
  navSettings = undefined;
  navFlags = undefined;
  window.localStorage.setItem(
    "ixstats:dailyReward:autoOpened:shell-user",
    new Date().toISOString().slice(0, 10)
  );
});

describe("FacetShell MyCountry Defense gating", () => {
  it("hides Defense without MyCountry Premium or the beta-tester role", () => {
    const nav = sidebarLinks();
    expect(nav.getByRole("link", { name: "Politics" })).toBeInTheDocument();
    expect(nav.queryByRole("link", { name: "Defense" })).toBeNull();
    for (const name of ["Intelligence", "Map editor", "Editor"]) {
      expect(nav.queryByRole("link", { name })).toBeNull();
    }
  });

  it("shows Defense to users who pass the premium ability", () => {
    premium = true;
    expect(sidebarLinks().getByRole("link", { name: "Defense" })).toHaveAttribute(
      "href",
      "/mycountry/defense"
    );
  });

  it("shows Defense to beta testers", () => {
    betaTester = true;
    expect(sidebarLinks().getByRole("link", { name: "Defense" })).toBeInTheDocument();
  });
});

describe("FacetShell Vault visibility", () => {
  it("shows the Vault card in the sidebar footer while the Vault app is visible", () => {
    const { container } = render(
      <AppShell>
        <p>Page</p>
      </AppShell>
    );
    expect(container.querySelector('[data-slot="sidebar-vault-card"]')).not.toBeNull();
  });

  it("shows no Vault card and no Wallet rail link when the Vault app is switched off", () => {
    navSettings = { showCardsTab: false };
    const { container } = render(
      <AppShell>
        <p>Page</p>
      </AppShell>
    );
    expect(container.querySelector('[data-slot="sidebar-vault-card"]')).toBeNull();
    expect(screen.queryByRole("link", { name: "Wallet" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Vault" })).toBeNull();
  });
});

describe("FacetShell ThinkPages sections", () => {
  const expandForum = () => {
    const nav = sidebarLinks();
    // The disclosure state is remembered in localStorage, so an earlier test may have left it open.
    const toggle = nav.queryByRole("button", { name: "Expand ThinkPages" });
    if (toggle) fireEvent.click(toggle);
    return nav;
  };

  it("lists Forums only until the viewer's flags arrive", () => {
    const nav = expandForum();
    expect(nav.getByRole("link", { name: "Forums" })).toHaveAttribute("href", "/thinkpages");
    expect(nav.queryByRole("link", { name: "Your realm" })).toBeNull();
    expect(nav.queryByRole("link", { name: "Moderation" })).toBeNull();
  });

  it("adds Your realm for a realm member and Moderation for a forum moderator", () => {
    navFlags = { realmMember: true, forumModerator: true };
    const nav = expandForum();
    expect(nav.getByRole("link", { name: "Your realm" })).toHaveAttribute(
      "href",
      "/thinkpages/r/mine"
    );
    expect(nav.getByRole("link", { name: "Moderation" })).toHaveAttribute(
      "href",
      "/thinkpages/mod"
    );
  });
});
