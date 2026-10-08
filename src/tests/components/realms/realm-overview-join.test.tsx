/**
 * The realm Overview's way in: one Join section, never two. A valid invite (`?via=` naming a player who holds a
 * nation here) shows the invite's Join panel in place of the open-nations Join section; without one, or while it
 * is still being checked, the open-nations section shows (or waits).
 */
import React from "react";
import type { ReactNode } from "react";
import { act, render, screen } from "@testing-library/react";

let mockSearch = "";
let mockInviter: { handle: string; displayName: string } | null = null;
let mockInviterLoading = false;
const queries: Record<string, unknown> = {};

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
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: () => undefined }));
// The sidebar panels have their own tests; the Overview's main column is what is tested here.
jest.mock("~/app/r/[realm]/_components/RealmSidebar", () => ({
  CensusPanel: () => null,
  CommunityPanel: () => null,
  EmbassiesPanel: () => null,
  HappeningsPanel: () => null,
  OfficersPanel: () => null,
  PollPanel: () => null,
}));
jest.mock("~/trpc/react", () => ({
  api: {
    realms: {
      getBySlug: { useQuery: () => ({ data: queries.hub }) },
      region: { overview: { useQuery: () => ({ data: queries.overview }) } },
      inviter: {
        useQuery: (_input: unknown, opts: { enabled: boolean }) =>
          opts.enabled
            ? { data: mockInviterLoading ? undefined : mockInviter, isLoading: mockInviterLoading }
            : { data: undefined, isLoading: false },
      },
    },
  },
}));

import RealmOverviewPage from "~/app/r/[realm]/(region)/page";

const overview = {
  realm: { id: "eurth", slug: "eurth", name: "Eurth" },
  factbook: null,
  board: { groupId: null, posts: [] },
  stats: { nations: 3, claimedNations: 1, population: 0 },
  rules: null,
  viewer: { signedIn: true, powers: [], ownedNations: [], boardRestriction: null },
};
const hub = {
  slug: "eurth",
  name: "Eurth",
  status: "active",
  claimsOpen: true,
  loreSource: null,
  lorePageCount: 0,
  countries: [
    { name: "Aurelia", claimed: false },
    { name: "Borealis", claimed: true },
  ],
  nationPages: [{ title: "Caledon" }],
};

async function renderOverview() {
  const params = Promise.resolve({ realm: "eurth" });
  await act(async () => {
    render(
      <React.Suspense fallback={null}>
        <RealmOverviewPage params={params} />
      </React.Suspense>
    );
    await params;
  });
}

const joinHeadings = () => screen.queryAllByRole("heading", { name: "Join Eurth" });

beforeEach(() => {
  queries.overview = overview;
  queries.hub = hub;
  mockSearch = "";
  mockInviter = null;
  mockInviterLoading = false;
});

describe("realm Overview join section", () => {
  it("shows the open nations without an invite", async () => {
    await renderOverview();
    expect(joinHeadings()).toHaveLength(1);
    expect(screen.getByText("2 nations are waiting for a player.", { exact: false })).toBeTruthy();
    expect(screen.queryByText(/invited you/)).toBeNull();
  });

  it("shows only the invite's Join panel when the invite holds up", async () => {
    mockSearch = "via=ambassador";
    mockInviter = { handle: "ambassador", displayName: "The Ambassador" };
    await renderOverview();
    expect(joinHeadings()).toHaveLength(1);
    expect(screen.getByText(/invited you/)).toHaveTextContent("@ambassador invited you");
    expect(screen.queryByText(/waiting for a player/)).toBeNull();
  });

  it("shows nothing to join while the invite is being checked", async () => {
    mockSearch = "via=ambassador";
    mockInviterLoading = true;
    await renderOverview();
    expect(joinHeadings()).toHaveLength(0);
  });

  it("falls back to the open nations when the invite names no member", async () => {
    mockSearch = "via=stranger";
    await renderOverview();
    expect(joinHeadings()).toHaveLength(1);
    expect(screen.getByText(/waiting for a player/)).toBeTruthy();
    expect(screen.queryByText(/invited you/)).toBeNull();
  });
});
