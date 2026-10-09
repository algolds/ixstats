/**
 * The Dashboard's Accounts section is the ThinkPages persona hub, mounted on the Dashboard: same
 * queries and empty state, an "Accounts" heading, a way back to the feed and a Saved posts link.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

let mockProfile: { countryId: string } | null = null;
let mockCountry: { id: string; name: string } | null = null;

jest.mock("~/trpc/react", () => ({
  api: {
    users: { getProfile: { useQuery: () => ({ data: mockProfile }) } },
    countries: { getMapSummary: { useQuery: () => ({ data: mockCountry }) } },
    thinkpages: { getMyAccounts: { useQuery: () => ({ data: [] }) } },
  },
}));
jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: { id: "u1" }, isSignedIn: true }),
}));
jest.mock("~/components/mycountry/primitives", () => ({
  AuthenticationGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("~/components/dashboard/accounts/EnhancedAccountManager", () => ({
  EnhancedAccountManager: () => null,
}));
jest.mock("~/components/dashboard/accounts/AccountCreationModal", () => ({
  AccountCreationModal: () => null,
}));
jest.mock("~/components/dashboard/accounts/AccountSettingsModal", () => ({
  AccountSettingsModal: () => null,
}));
jest.mock("~/components/dashboard/accounts/AccountManagerModal", () => ({
  AccountManagerModal: () => null,
}));

import { AccountsSection } from "~/components/dashboard/accounts/AccountsSection";

beforeEach(() => {
  mockProfile = { countryId: "c1" };
  mockCountry = { id: "c1", name: "Testland" };
});

describe("AccountsSection", () => {
  it("heads the section Accounts with the feed, saved posts and new account actions", () => {
    const onBack = jest.fn();
    render(<AccountsSection initialCountryId="c1" onBack={onBack} />);
    expect(screen.getByRole("heading", { level: 1, name: "Accounts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Saved posts" })).toHaveAttribute(
      "href",
      "/dashboard/saved"
    );
    expect(screen.getByRole("button", { name: "New account" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Feed" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("offers no Feed button without a way back", () => {
    render(<AccountsSection initialCountryId="c1" />);
    expect(screen.queryByRole("button", { name: "Feed" })).not.toBeInTheDocument();
  });

  it("no longer says the feed has moved (this is the Dashboard)", () => {
    render(<AccountsSection initialCountryId="c1" />);
    expect(screen.queryByText(/has moved/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Go to dashboard/ })).not.toBeInTheDocument();
  });

  it("asks for country setup without a country", () => {
    mockProfile = { countryId: "" };
    mockCountry = null;
    render(<AccountsSection />);
    expect(screen.getByText("Country setup required")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Complete setup" })).toHaveAttribute("href", "/setup");
  });
});
