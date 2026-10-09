/**
 * DashboardRouter shows one section at a time: Home (hero + feed) or Accounts (the persona hub),
 * and hands section switches up to the page's section router.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    countries: {
      getGlobalStats: { useQuery: jest.fn(() => ({ data: undefined })) },
      getMapLinkStatus: { useQuery: () => ({ data: undefined }) },
    },
    users: { getProfile: { useQuery: () => ({ data: null }) } },
  },
}));
jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: null }) }));
jest.mock("next/navigation", () => {
  const push = jest.fn();
  return { useRouter: () => ({ push }) };
});
jest.mock("~/components/dashboard/hero/DashboardHero", () => ({
  DashboardHero: () => <div>hero</div>,
}));
jest.mock("~/components/dashboard/sections/UnifiedDashboardSection", () => ({
  UnifiedDashboardSection: ({ onOpenAccounts }: { onOpenAccounts?: () => void }) => (
    <button type="button" onClick={onOpenAccounts}>
      feed
    </button>
  ),
}));
jest.mock("~/components/dashboard/accounts/AccountsSection", () => ({
  AccountsSection: ({
    onBack,
    initialCountryId,
  }: {
    onBack?: () => void;
    initialCountryId?: string;
  }) => (
    <button type="button" onClick={onBack}>
      accounts {initialCountryId}
    </button>
  ),
}));

import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { DashboardRouter } from "~/components/dashboard/DashboardRouter";

const globalStatsQuery = jest.mocked(api.countries.getGlobalStats.useQuery);
const routerPush = jest.mocked(useRouter().push);

describe("DashboardRouter", () => {
  beforeEach(() => {
    globalStatsQuery.mockClear();
    routerPush.mockClear();
  });

  it("shows the hero and the feed on Home, and opens Accounts from the feed", () => {
    const onNavigate = jest.fn();
    render(<DashboardRouter initialCountryId="c1" onNavigate={onNavigate} />);
    expect(screen.getByText("hero")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "feed" }));
    expect(onNavigate).toHaveBeenCalledWith("accounts");
    expect(globalStatsQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ enabled: true })
    );
  });

  it("shows only the Accounts section there, with a way back to Home", async () => {
    const onNavigate = jest.fn();
    render(<DashboardRouter initialCountryId="c1" section="accounts" onNavigate={onNavigate} />);
    // The section is loaded with next/dynamic, so it arrives after the first render.
    fireEvent.click(await screen.findByRole("button", { name: "accounts c1" }));
    expect(screen.queryByText("hero")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "feed" })).not.toBeInTheDocument();
    expect(onNavigate).toHaveBeenCalledWith("home");
    expect(globalStatsQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ enabled: false })
    );
  });

  it("opens the Accounts page from the feed on / (no section router)", () => {
    render(<DashboardRouter />);
    fireEvent.click(screen.getByRole("button", { name: "feed" }));
    expect(routerPush).toHaveBeenCalledWith("/dashboard/accounts");
  });

  it("switches the section in place when it has a section router", () => {
    render(<DashboardRouter onNavigate={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "feed" }));
    expect(routerPush).not.toHaveBeenCalled();
  });
});
