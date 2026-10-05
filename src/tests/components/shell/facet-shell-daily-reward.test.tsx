import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/vault",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));
jest.mock("@clerk/nextjs", () => ({ useAuth: () => ({ userId: "shell-user" }) }));
jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: { id: "shell-user" } }) }));
jest.mock("~/hooks/usePermissions", () => ({
  useHasPermission: () => false,
  useHasRoleLevel: () => false,
  useIsBetaTester: () => false,
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      vault: { getBalance: { invalidate: jest.fn() } },
      cards: { getMyCards: { invalidate: jest.fn() } },
    }),
    admin: {
      getNavigationSettings: { useQuery: () => ({ data: undefined }) },
    },
    vault: {
      getBalance: {
        useQuery: () => ({ data: { canClaimDailyBonus: true, loginStreak: 2 }, isLoading: false }),
      },
      claimCombinedDailyClaim: { useMutation: () => ({ mutate: jest.fn() }) },
    },
  },
}));
jest.mock("~/components/shell/use-nav-badges", () => ({
  useNavBadges: () => ({ "daily-reward": { kind: "action", label: "2d" } }),
}));
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

describe("FacetShell daily reward action", () => {
  it("opens the dialog from the sidebar row", () => {
    // Today's auto-open is already spent, so the dialog only shows once the row is clicked.
    window.localStorage.setItem(
      "ixstats:dailyReward:autoOpened:shell-user",
      new Date().toISOString().slice(0, 10)
    );
    render(
      <AppShell>
        <p>Page</p>
      </AppShell>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    const nav = screen.getByRole("navigation", { name: "App navigation" });
    fireEvent.click(within(nav).getByRole("button", { name: /Daily reward/ }));
    expect(
      within(screen.getByRole("dialog")).getByRole("heading", { name: "Daily reward" })
    ).toBeInTheDocument();
  });
});
