/**
 * The welcome page after founding: the nation's header (name and facts), "<Name> is founded" and
 * the one action, Open MyCountry. Skeletons while loading; a player without a nation goes to the
 * builder.
 */
import "react";
import { render } from "@testing-library/react";

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
  it("sends a player without a nation to the builder", () => {
    load({ data: null, isSuccess: true });
    render(<MyCountryWelcomePage />);
    expect(mockReplace).toHaveBeenCalledWith("/builder");
  });
});
