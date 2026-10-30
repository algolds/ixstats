/** The signed-in account panel carries a theme row that shows the stored preference and cycles it. */
import { fireEvent, render, screen } from "@testing-library/react";
import type { Theme } from "~/context/theme-context";
import { AccountMenu } from "~/components/shell/AccountMenu";

const toggleTheme = jest.fn();
let theme: Theme = "system";

jest.mock("~/context/theme-context", () => ({
  ...jest.requireActual("~/context/theme-context"),
  useTheme: () => ({ theme, effectiveTheme: "light", toggleTheme }),
}));
jest.mock("~/context/auth-context", () => ({
  useAuth: () => ({ signOut: jest.fn() }),
  useUser: () => ({ user: { firstName: "Ada", imageUrl: null } }),
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("~/trpc/react", () => ({
  api: { users: { getProfile: { useQuery: () => ({ data: undefined }) } } },
}));
jest.mock("~/hooks/useCountryFlags", () => ({ useCountryFlag: () => ({ flag: null }) }));
jest.mock("~/hooks/useUserCountry", () => ({ useUserCountry: () => ({ country: null }) }));
jest.mock("~/components/navigation/NationSwitcher", () => ({ NationSwitcher: () => null }));
jest.mock("~/components/shell/AppSidebar", () => ({
  CollapsedTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  rowBase: "",
}));

describe("account menu theme row", () => {
  beforeEach(() => {
    toggleTheme.mockClear();
    theme = "system";
  });

  it("reads the stored preference and cycles it on click", () => {
    render(<AccountMenu layout="sheet" />);
    const row = screen.getByRole("button", { name: "Theme: System" });
    fireEvent.click(row);
    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["dark", "Theme: Dark"],
    ["light", "Theme: Light"],
  ] as const)("shows %s", (value, label) => {
    theme = value;
    render(<AccountMenu layout="sheet" />);
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  });
});
