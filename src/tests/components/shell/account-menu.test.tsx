import React from "react";
import { render, screen, within } from "@testing-library/react";

type Country = { id: string; name: string; flag: string; slug: string };

let signedIn = true;
let country: Country | null = null;

jest.mock("~/context/auth-context", () => ({
  useAuth: () => ({ signOut: () => Promise.resolve() }),
  useUser: () => ({
    user: signedIn ? { id: "u1", firstName: "Dee", username: "dee_", imageUrl: "u.png" } : null,
  }),
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("~/hooks/useUserCountry", () => ({
  useUserCountry: () => ({ country, hasCountry: Boolean(country) }),
}));
jest.mock("~/hooks/useCountryFlags", () => ({ useCountryFlag: () => ({ flag: null }) }));
jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: ({ countryName, flagUrl }: { countryName: string; flagUrl?: string }) => (
    <img data-testid="country-flag" alt="" data-country={countryName} src={flagUrl} />
  ),
}));
jest.mock("~/components/navigation/NationSwitcher", () => ({ NationSwitcher: () => null }));
jest.mock("~/trpc/react", () => ({
  api: {
    users: {
      getProfile: {
        useQuery: () => ({
          data: country ? { countryId: country.id, country } : { countryId: null },
        }),
      },
    },
  },
}));

import { AccountMenu } from "~/components/shell/AccountMenu";

beforeEach(() => {
  signedIn = true;
  country = { id: "c1", name: "Caphiria", flag: "f.png", slug: "caphiria" };
});

describe("AccountMenu identity rows", () => {
  it("links your country (flag and name) to its public page, with no separate public page row", () => {
    render(<AccountMenu layout="sheet" />);
    const link = screen.getByRole("link", { name: "Caphiria" });
    expect(link).toHaveAttribute("href", expect.stringContaining("caphiria"));
    expect(link).not.toHaveAttribute("href", "/mycountry");
    expect(within(link).getByTestId("country-flag")).toHaveAttribute("src", "f.png");
    expect(screen.queryByRole("link", { name: "Public country page" })).toBeNull();
  });

  it("links your Passport and your Stash, and no wiki profile", () => {
    render(<AccountMenu layout="sheet" />);
    expect(screen.getByRole("link", { name: "Passport" })).toHaveAttribute("href", "/@me");
    expect(screen.getByRole("link", { name: "Stash" })).toHaveAttribute("href", "/stashes");
    expect(screen.queryByRole("link", { name: "Wiki profile" })).toBeNull();
  });

  it("links Passport settings to the IxnayID & passport panel", () => {
    render(<AccountMenu layout="sheet" />);
    expect(screen.getByRole("link", { name: "Passport settings" })).toHaveAttribute(
      "href",
      "/settings?tab=account"
    );
    expect(screen.queryByRole("link", { name: "IxnayID connections" })).toBeNull();
  });

  it("omits the country row when you have no country", () => {
    country = null;
    render(<AccountMenu layout="sheet" />);
    expect(screen.queryByTestId("country-flag")).toBeNull();
    expect(screen.queryByRole("link", { name: "Caphiria" })).toBeNull();
    expect(screen.getByRole("link", { name: "Passport" })).toBeInTheDocument();
  });

  it("keeps Privacy and Terms reachable here, for the collapsed rail and the phone sheet", () => {
    render(<AccountMenu layout="sheet" />);
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  });

  it("shows none of the identity rows when signed out", () => {
    signedIn = false;
    render(<AccountMenu layout="sheet" />);
    expect(screen.queryByRole("link", { name: "Passport" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Stash" })).toBeNull();
    expect(screen.queryByTestId("country-flag")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("opens from the sidebar's account row", () => {
    render(<AccountMenu layout="sidebar" />);
    expect(screen.getByRole("button", { name: "Account: Dee" })).toBeInTheDocument();
  });
});
