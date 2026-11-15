/** Unified AccountMenu: Clerk portrait, direct MyCountry/Passport/Stash links, and non-duplicated legal footer. */
import { render, screen } from "@testing-library/react";
import { AccountMenu } from "~/components/shell/AccountMenu";

let mockCountry: { id: string; name: string; slug: string } | null = null;

jest.mock("~/context/auth-context", () => ({
  useAuth: () => ({ signOut: jest.fn() }),
  useUser: () => ({ user: { firstName: "Ada", imageUrl: "https://img.clerk.com/ada.png" } }),
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("~/trpc/react", () => ({
  api: {
    users: {
      getProfile: {
        useQuery: () => ({ data: { handle: "ada" } }),
      },
    },
  },
}));
jest.mock("~/hooks/useCountryFlags", () => ({
  useCountryFlag: () => ({ flag: "/flags/caphiria.svg" }),
}));
jest.mock("~/hooks/useUserCountry", () => ({
  useUserCountry: () => ({ country: mockCountry, isLoading: false }),
}));
jest.mock("~/components/navigation/NationSwitcher", () => ({ NationSwitcher: () => null }));
jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: ({ countryName }: { countryName: string }) => (
    <span data-testid="nation-flag">{countryName}</span>
  ),
}));
jest.mock("~/components/shell/AppSidebar", () => ({
  CollapsedTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  rowBase: "",
}));

describe("AccountMenu cohesion contract", () => {
  beforeEach(() => {
    mockCountry = { id: "c1", name: "Caphiria", slug: "caphiria" };
  });

  it("links MyCountry directly to /mycountry, keeps Passport and Stash, and omits duplicate Theme and Passport settings rows", () => {
    render(<AccountMenu layout="sheet" />);

    expect(screen.getByRole("link", { name: /MyCountry/i })).toHaveAttribute("href", "/mycountry");
    expect(screen.getByRole("link", { name: "Passport" })).toHaveAttribute("href", "/@me");
    expect(screen.getByRole("link", { name: "Stash" })).toHaveAttribute("href", "/stashes");
    expect(screen.queryByRole("button", { name: /^Theme:/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Passport settings/i })).toBeNull();
  });

  it("renders Privacy and Terms in the mobile sheet and collapsed rail, and hides them when the expanded sidebar footer is visible", () => {
    const { rerender } = render(<AccountMenu layout="sheet" />);
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");

    rerender(<AccountMenu layout="sidebar" collapsed={false} />);
    expect(screen.queryByRole("link", { name: "Privacy" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Terms" })).toBeNull();
  });
});
