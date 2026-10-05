import React from "react";
import { render, screen, within } from "@testing-library/react";

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

  it("falls back to the account username when no wiki account is linked", () => {
    wikiProfile = null;
    render(<AccountMenu layout="sheet" />);
    expect(screen.getByRole("link", { name: "Wiki profile" })).toHaveAttribute(
      "href",
      "/@dee_?tab=work"
    );
  });

  it("omits the country row when you have no country", () => {
    country = null;
    render(<AccountMenu layout="sheet" />);
    expect(screen.queryByTestId("country-flag")).toBeNull();
    expect(screen.queryByRole("link", { name: "Caphiria" })).toBeNull();
    expect(screen.getByRole("link", { name: "Your profile" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wiki profile" })).toBeInTheDocument();
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
});
