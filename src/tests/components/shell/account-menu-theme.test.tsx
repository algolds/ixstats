/** Unified AccountMenu: Clerk portrait + active nation on sidebar trigger, direct identity links, feedback, and version/legal footer. */
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("links MyCountry directly to /mycountry, keeps Passport, Stash, and Send feedback, and omits duplicate Theme and Passport settings rows", () => {
    const onOpenFeedback = jest.fn();
    render(<AccountMenu layout="sheet" onOpenFeedback={onOpenFeedback} />);

    expect(screen.getByRole("link", { name: /MyCountry/i })).toHaveAttribute("href", "/mycountry");
    expect(screen.getByRole("link", { name: "Passport" })).toHaveAttribute("href", "/@me");
    expect(screen.getByRole("link", { name: "Stash" })).toHaveAttribute("href", "/stashes");
    expect(screen.queryByRole("button", { name: /^Theme:/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Passport settings/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(onOpenFeedback).toHaveBeenCalledTimes(1);
  });

  it("displays Ada · Caphiria on the sidebar trigger and renders version, Privacy, and Terms inside the AccountPanel", () => {
    const { rerender } = render(<AccountMenu layout="sheet" />);
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");

    rerender(<AccountMenu layout="sidebar" collapsed={false} />);
    const trigger = screen.getByRole("button", { name: "Account: Ada · Caphiria" });
    expect(trigger).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Privacy" })).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  });
});
