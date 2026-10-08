/**
 * The realm's Join panel for an invite link: "@handle invited you" only when the server says `via` names a
 * member of the realm; the invite carries on to the nations list, or through sign-in.
 */
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { RealmInvitePanel } from "~/app/r/[realm]/_components/RealmInvitePanel";

let mockSearch = "";
let mockSignedIn = true;
let mockInviter: { handle: string; displayName: string } | null = null;
const mockUseQuery = jest.fn(
  (_input: { slug: string; via: string }, _opts: { enabled: boolean }) => ({
    data: mockInviter,
  })
);

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(mockSearch) }));
jest.mock("~/context/auth-context", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: mockSignedIn }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    realms: {
      inviter: {
        useQuery: (input: { slug: string; via: string }, opts: { enabled: boolean }) =>
          mockUseQuery(input, opts),
      },
    },
  },
}));

const renderPanel = () => render(<RealmInvitePanel realmSlug="eurth" realmName="Eurth" />);

beforeEach(() => {
  jest.clearAllMocks();
  mockSearch = "via=ambassador";
  mockSignedIn = true;
  mockInviter = { handle: "ambassador", displayName: "The Ambassador" };
});

describe("RealmInvitePanel", () => {
  it("names the inviter and links on to the nations list with the invite", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "Join Eurth" })).toBeInTheDocument();
    expect(screen.getByText(/invited you/)).toHaveTextContent("@ambassador invited you");
    expect(screen.getByRole("link", { name: "@ambassador" })).toHaveAttribute(
      "href",
      "/@ambassador"
    );
    expect(screen.getByRole("link", { name: "Find a nation to claim" })).toHaveAttribute(
      "href",
      "/r/eurth/nations?via=ambassador"
    );
    expect(mockUseQuery).toHaveBeenCalledWith(
      { slug: "eurth", via: "ambassador" },
      { enabled: true }
    );
  });

  it("keeps the invite through sign-in for signed-out visitors", () => {
    mockSignedIn = false;
    renderPanel();
    expect(screen.getByRole("link", { name: "Sign in to claim a nation" })).toHaveAttribute(
      "href",
      `/sign-in?redirect_url=${encodeURIComponent("/r/eurth?via=ambassador")}`
    );
  });

  it("shows nothing when via names no member of the realm", () => {
    mockInviter = null;
    const { container } = renderPanel();
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing and asks nothing without a via", () => {
    mockSearch = "";
    const { container } = renderPanel();
    expect(container).toBeEmptyDOMElement();
    expect(mockUseQuery).toHaveBeenCalledWith({ slug: "eurth", via: "" }, { enabled: false });
  });
});
