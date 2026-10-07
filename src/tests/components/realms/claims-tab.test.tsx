import { render, screen, within } from "@testing-library/react";
import { ClaimsTab } from "~/app/admin/realms/_components/ClaimsTab";

const baseClaim = {
  id: "cl1",
  createdAt: "2026-09-28T12:00:00Z",
  realm: { id: "eurth-id", name: "Eurth", slug: "eurth" },
  user: { id: "u1", clerkUserId: "clerk_u1", wikiUsername: null, wikiAccountLinks: [] },
};
let mockClaims: object[] = [];

jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: { id: "clerk_officer" } }) }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), info: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ realms: { listClaims: { invalidate: jest.fn() } } }),
    realms: {
      listClaims: { useQuery: () => ({ data: mockClaims, isLoading: false }) },
      reviewClaim: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
    },
  },
}));

describe("ClaimsTab", () => {
  it("names a nation-page claim by its page, marked as a new nation", () => {
    mockClaims = [{ ...baseClaim, country: null, wikiSource: "iiwiki", wikiPageTitle: "Aurelia" }];
    render(<ClaimsTab />);
    expect(screen.getByText(/Aurelia/)).toBeInTheDocument();
    expect(screen.getByText(/new nation from IIWiki/i)).toBeInTheDocument();
    expect(screen.queryByText(/Unknown nation/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Page history" }).getAttribute("href")).toMatch(
      /^https:\/\/iiwiki\.com\/.*Aurelia\?action=history$/
    );
  });

  it("names a country claim by its country", () => {
    mockClaims = [
      {
        ...baseClaim,
        country: { id: "c1", name: "Borea", slug: "borea", flag: null, wikiPageTitle: null },
        wikiSource: null,
        wikiPageTitle: null,
      },
    ];
    render(<ClaimsTab />);
    expect(screen.getByText(/Borea/)).toBeInTheDocument();
    expect(screen.queryByText(/new nation/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Page history" })).not.toBeInTheDocument();
  });

  it("lets an officer approve others' claims but not their own", () => {
    const country = { id: "c1", name: "Borea", slug: "borea", flag: null, wikiPageTitle: null };
    const own = { clerkUserId: "clerk_officer", wikiUsername: "Officer" };
    mockClaims = [
      { ...baseClaim, country, wikiSource: null, wikiPageTitle: null },
      {
        ...baseClaim,
        id: "cl2",
        user: { ...baseClaim.user, ...own },
        country: { ...country, id: "c2", name: "Calder" },
        wikiSource: null,
        wikiPageTitle: null,
      },
    ];
    render(<ClaimsTab realmId="eurth-id" canApproveOwn={false} />);
    const [others, mine] = screen.getAllByRole("listitem");
    expect(within(others!).getByRole("button", { name: "Approve" })).toBeEnabled();
    expect(within(mine!).getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(within(mine!).getByRole("button", { name: "Reject" })).toBeEnabled();
  });

  it("lets the founder and site admins approve their own claims", () => {
    mockClaims = [
      {
        ...baseClaim,
        user: { ...baseClaim.user, clerkUserId: "clerk_officer" },
        country: { id: "c1", name: "Borea", slug: "borea", flag: null, wikiPageTitle: null },
        wikiSource: null,
        wikiPageTitle: null,
      },
    ];
    render(<ClaimsTab />);
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
  });
});
