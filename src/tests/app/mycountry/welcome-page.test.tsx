/**
 * The welcome page after founding: the nation's header (name and facts), "<Name> is founded" and
 * the one action, Open MyCountry. Skeletons while loading; a player without a nation goes to the
 * builder.
 */
import React from "react";
import { render, screen } from "@testing-library/react";

type Query = {
  data?: unknown;
  isSuccess: boolean;
  isError: boolean;
  refetch: () => void;
};
const mockQuery: { current: Query } = {
  current: { data: undefined, isSuccess: false, isError: false, refetch: jest.fn() },
};
const mockReplace = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: { mycountry: { getWelcome: { useQuery: () => mockQuery.current } } },
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: { id: "user_1" }, isLoaded: true }),
}));
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));
jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: ({ countryName }: { countryName: string }) => (
    <img alt={`Flag of ${countryName}`} />
  ),
}));

import MyCountryWelcomePage from "~/app/mycountry/welcome/page";
import { MYCOUNTRY_WELCOME_PATH } from "~/lib/mycountry/routes";

const nation = {
  id: "c1",
  name: "Testland",
  slug: "testland",
  flag: "https://example.com/flag.svg",
  realmName: "Ixnay",
  population: 12_400_000,
  capital: "Port Test",
};

function load(partial: Partial<Query>) {
  mockQuery.current = {
    data: undefined,
    isSuccess: false,
    isError: false,
    refetch: jest.fn(),
    ...partial,
  };
}

beforeEach(() => mockReplace.mockClear());

describe("the welcome page", () => {
  it("shows the nation, its facts and the one way on", () => {
    load({ data: nation, isSuccess: true });
    render(<MyCountryWelcomePage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Testland" })).toBeInTheDocument();
    expect(screen.getByText("Ixnay · 12.4M people · Capital: Port Test")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Flag of Testland" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Testland is founded" })
    ).toBeInTheDocument();
    expect(screen.getByText(/now your active nation/)).toBeInTheDocument();

    const action = screen.getByRole("link", { name: "Open MyCountry" });
    expect(action).toHaveAttribute("href", "/mycountry");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("leaves out facts the nation does not have yet", () => {
    load({ data: { ...nation, realmName: null, capital: null }, isSuccess: true });
    render(<MyCountryWelcomePage />);
    expect(screen.getByText("12.4M people")).toBeInTheDocument();
  });

  it("shows skeletons while the nation loads", () => {
    load({});
    render(<MyCountryWelcomePage />);
    expect(screen.getByLabelText("Loading your nation")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("link", { name: "Open MyCountry" })).not.toBeInTheDocument();
  });

  it("sends a player without a nation to the builder", () => {
    load({ data: null, isSuccess: true });
    render(<MyCountryWelcomePage />);
    expect(mockReplace).toHaveBeenCalledWith("/builder");
  });

  it("is reachable at the path the builder links to", () => {
    expect(MYCOUNTRY_WELCOME_PATH).toBe("/mycountry/welcome");
  });
});
