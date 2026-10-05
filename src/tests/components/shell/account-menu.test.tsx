import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

type Country = { id: string; name: string; flag: string; slug: string };

let signedIn = true;
let country: Country | null = null;
let wikiProfile: { displayName: string } | null = null;
const authorProfileQuery = jest.fn();

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
    wikios: {
      getAuthorProfile: {
        useQuery: (_input: unknown, opts: { enabled: boolean }) => {
          authorProfileQuery(opts);
          return { data: opts.enabled ? wikiProfile : undefined };
        },
      },
    },
  },
}));

import { AccountMenu } from "~/components/shell/AccountMenu";
import { TabBar } from "~/components/shell/TabBar";
import { getVisibleApps } from "~/lib/navigation/app-sections";

beforeEach(() => {
  signedIn = true;
  country = { id: "c1", name: "Caphiria", flag: "f.png", slug: "caphiria" };
  wikiProfile = { displayName: "Dee Wiki" };
  authorProfileQuery.mockClear();
});

describe("AccountMenu identity rows", () => {
  it("links your country (flag and name) to MyCountry", () => {
    render(<AccountMenu layout="sheet" />);
    const link = screen.getByRole("link", { name: "Caphiria" });
    expect(link).toHaveAttribute("href", "/mycountry");
    expect(within(link).getByTestId("country-flag")).toHaveAttribute("src", "f.png");
  });

  it("links your passport profile and your wiki profile", () => {
    render(<AccountMenu layout="sheet" />);
    expect(screen.getByRole("link", { name: "Your profile" })).toHaveAttribute("href", "/@me");
    expect(screen.getByRole("link", { name: "Wiki profile" })).toHaveAttribute(
      "href",
      "/@Dee%20Wiki?tab=work"
    );
  });

  it("falls back to the signed-in player's own work tab when no wiki account is linked", () => {
    wikiProfile = null;
    render(<AccountMenu layout="sheet" />);
    expect(screen.getByRole("link", { name: "Wiki profile" })).toHaveAttribute(
      "href",
      "/@me?tab=work"
    );
  });

  it("gives the country row and the public page link distinct destinations and labels", () => {
    render(<AccountMenu layout="sheet" />);
    expect(screen.getByRole("link", { name: "Caphiria" })).toHaveAttribute("href", "/mycountry");
    expect(screen.queryByRole("link", { name: "Your nation" })).toBeNull();
    const publicPage = screen.getByRole("link", { name: "Public country page" });
    expect(publicPage).toHaveAttribute("href", expect.stringContaining("caphiria"));
    expect(publicPage).not.toHaveAttribute("href", "/mycountry");
  });

  it("omits the country row when you have no country", () => {
    country = null;
    render(<AccountMenu layout="sheet" />);
    expect(screen.queryByTestId("country-flag")).toBeNull();
    expect(screen.queryByRole("link", { name: "Caphiria" })).toBeNull();
    expect(screen.getByRole("link", { name: "Your profile" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wiki profile" })).toBeInTheDocument();
  });

  it("keeps Privacy and Terms reachable here, for the collapsed rail and the phone sheet", () => {
    render(<AccountMenu layout="sheet" />);
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  });

  it("shows none of the three rows when signed out", () => {
    signedIn = false;
    render(<AccountMenu layout="sheet" />);
    expect(screen.queryByRole("link", { name: "Your profile" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Wiki profile" })).toBeNull();
    expect(screen.queryByTestId("country-flag")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("loads the wiki profile only once the panel is open", () => {
    render(<AccountMenu layout="sidebar" />);
    expect(screen.getByRole("button", { name: "Account: Dee" })).toBeInTheDocument();
    expect(authorProfileQuery).not.toHaveBeenCalled();
  });

  it("loads the wiki profile in the tab bar's sheet layout only once More is opened", () => {
    render(
      <TabBar
        pathname="/dashboard"
        searchParams={null}
        apps={getVisibleApps({ signedIn: true, isAdmin: false })}
        expanded={new Set()}
        onToggle={() => undefined}
        badges={{}}
        account={<AccountMenu layout="sheet" />}
      />
    );
    expect(authorProfileQuery).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(authorProfileQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });
});
