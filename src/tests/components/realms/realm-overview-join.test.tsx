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
  forum: { threads: [] },
  stats: { nations: 3, claimedNations: 1, population: 0 },
  rules: null,
  viewer: { signedIn: true, powers: [], ownedNations: [] },
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

describe("realm Overview forum section", () => {
  const forumHub = "/thinkpages/r/eurth/hub";

  it("lists the Hub's latest threads with replies and age, each linking to the thread", async () => {
    queries.overview = {
      ...overview,
      forum: {
        threads: [
          {
            id: "t1",
            title: "Welcome to Eurth",
            replies: 1,
            lastPostAt: new Date(Date.now() - 3 * 3_600_000),
          },
          {
            id: "t2",
            title: "Rules question",
            replies: 4,
            lastPostAt: new Date(Date.now() - 5 * 60_000),
          },
        ],
      },
    };
    await renderOverview();
    expect(screen.getByRole("heading", { name: "Latest on the forum" })).toBeTruthy();
    expect(screen.queryByText("Latest on the board")).toBeNull();
    const link = screen.getByRole("link", { name: /Welcome to Eurth/ });
    expect(link.getAttribute("href")).toBe("/thinkpages/t/t1");
    expect(link.textContent).toContain("1 reply");
    expect(link.textContent).toContain("3h ago");
    const second = screen.getByRole("link", { name: /Rules question/ });
    expect(second.textContent).toContain("4 replies");
    expect(screen.getByRole("link", { name: "Open the forum" }).getAttribute("href")).toBe(
      forumHub
    );
  });

  it("invites a nation owner to post, and tells a visitor what the forum is for", async () => {
    queries.overview = {
      ...overview,
      viewer: {
        ...overview.viewer,
        ownedNations: [{ id: "c1", name: "Aurelia", slug: "aurelia" }],
      },
    };
    await renderOverview();
    expect(screen.getByText("No threads yet. Yours can be the first.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open the forum to post" }).getAttribute("href")).toBe(
      forumHub
    );
  });

  it("explains an empty forum to visitors", async () => {
    await renderOverview();
    expect(
      screen.getByText("No threads yet. The forum is where the nations of Eurth talk.")
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open the forum" }).getAttribute("href")).toBe(
      forumHub
    );
  });
});
