/** Halo MyCountry view: loading, signed-out, no-nation and error each show their own state. */
import { fireEvent, render, screen } from "@testing-library/react";
import { MyCountryView } from "~/components/halo/plugins/mycountry/views/MyCountryView";

const mockUseUser = jest.fn();
const mockProfileQuery = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: { users: { getProfile: { useQuery: (...args: unknown[]) => mockProfileQuery(...args) } } },
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/",
}));
jest.mock("~/context/auth-context", () => ({
  useUser: () => mockUseUser(),
  SignOutButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("~/components/shared/country-actions/CountryActionsProvider", () => ({
  useOpenCountryActions: () => jest.fn(),
}));
jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: () => null,
}));
jest.mock("~/components/ui/pretext", () => ({
  PreText: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const signedIn = { user: { id: "u1", firstName: "Ada" }, isLoaded: true };

function renderView() {
  const onClose = jest.fn();
  render(<MyCountryView onClose={onClose} />);
  return { onClose };
}

describe("MyCountryView states", () => {
  it("shows skeletons, not a sign-in prompt, while the profile loads", () => {
    mockUseUser.mockReturnValue(signedIn);
    mockProfileQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderView();
    expect(screen.queryByText("Sign in")).toBeNull();
    expect(screen.getByRole("status", { name: "Loading your profile" })).toBeInTheDocument();
  });

  it("shows no sign-in prompt while the session itself loads", () => {
    mockUseUser.mockReturnValue({ user: null, isLoaded: false });
    mockProfileQuery.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    renderView();
    expect(screen.queryByText("Sign in")).toBeNull();
  });

  it("offers to found a nation when the user has none", () => {
    mockUseUser.mockReturnValue(signedIn);
    mockProfileQuery.mockReturnValue({
      data: { countryId: null, country: null },
      isLoading: false,
      isError: false,
    });
    renderView();
    expect(screen.getByText("You don't have a nation yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Found a nation" })).toBeInTheDocument();
    expect(screen.queryByText("Sign in")).toBeNull();
  });

  it("offers a retry when the profile fails to load", () => {
    const refetch = jest.fn();
    mockUseUser.mockReturnValue(signedIn);
    mockProfileQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    renderView();
    expect(screen.getByText("Couldn't load your profile")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Sign in")).toBeNull();
  });

  it("asks a signed-out visitor to sign in", () => {
    mockUseUser.mockReturnValue({ user: null, isLoaded: true });
    mockProfileQuery.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    renderView();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});
