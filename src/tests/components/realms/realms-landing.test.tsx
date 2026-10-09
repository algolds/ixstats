/**
 * The /realms landing page: the hero's call to action follows the viewer (signed out, no nation, holding nations),
 * Your realms lists the viewer's nations with Play as, one search finds realms and nations (with their realm and
 * whether they are claimable), Open to join lists realms with nations to take, and Browse keeps the tag filter.
 */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/realms",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

global.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const queries: Record<string, unknown> = {};
const queryInputs: Record<string, unknown[]> = {};
const mutate = jest.fn();
let auth = { isLoaded: true, isSignedIn: false };

/** `api.a.b.useQuery()` answers from `queries["a.b"]` (and records its input); every mutation is `mutate`. */
function apiProxy(path: string[] = []): unknown {
  return new Proxy(() => undefined, {
    get: (_t, prop: string) => {
      if (prop === "useQuery")
        return (input: unknown, opts?: { enabled?: boolean }) => {
          const key = path.join(".");
          (queryInputs[key] ??= []).push(input);
          const enabled = opts?.enabled ?? true;
          return { data: enabled ? queries[key] : undefined, isLoading: false };
        };
      if (prop === "useMutation") return () => ({ mutate, mutateAsync: mutate, isPending: false });
      if (prop === "useUtils") return () => apiProxy(["utils"]);
      if (prop === "invalidate") return jest.fn();
      return apiProxy([...path, prop]);
    },
  });
}
jest.mock("~/trpc/react", () => ({ api: apiProxy() }));
jest.mock("~/context/auth-context", () => ({ useAuth: () => auth }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: () => undefined }));
jest.mock("~/hooks/useViewerRealmId", () => ({ useViewerRealmId: () => null }));
jest.mock("~/hooks/useDebounce", () => ({ useDebounce: <T,>(value: T) => value }));
jest.mock("~/app/r/[realm]/_components/RealmFeed", () => ({
  RealmFeed: ({ realmId }: { realmId: string | null }) => <p>feed for {realmId ?? "all"}</p>,
}));

import RealmsLandingPage from "~/app/realms/page";

function realm(overrides: Record<string, unknown> = {}) {
  return {
    id: "eurth",
    slug: "eurth",
    name: "Eurth",
    description: "A world of many nations",
    thumbnail: null,
    bannerUrl: null,
    tags: ["Fantasy"],
    foundedAt: new Date("2025-06-01"),
    nationCount: 12,
    openNationCount: 2,
    openNationPageCount: 3,
    myNationCount: 0,
    maxNationsPerUser: 2,
    board: { recentPosts: 0, lastPostAt: null },
    ...overrides,
  };
}

const EURTH = realm();
const QUIET = realm({
  id: "quiet",
  slug: "quiet",
  name: "Quietlands",
  description: "Calm seas",
  tags: ["Modern"],
  nationCount: 4,
  openNationCount: 0,
  openNationPageCount: 0,
});

beforeEach(() => {
  for (const key of Object.keys(queries)) delete queries[key];
  for (const key of Object.keys(queryInputs)) delete queryInputs[key];
  queries["realms.directory"] = [EURTH, QUIET];
  auth = { isLoaded: true, isSignedIn: false };
});

describe("realms landing hero", () => {
  it("asks a signed-out viewer to sign in or browse, with the realm totals", () => {
    render(<RealmsLandingPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Realms" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in to play" }).getAttribute("href")).toContain(
      "/sign-in?redirect_url="
    );
    expect(screen.getByRole("link", { name: "Browse realms" }).getAttribute("href")).toBe(
      "#browse-realms"
    );
    const header = screen.getByRole("banner");
    expect(within(header).getByText("Open to claim").nextSibling?.textContent).toBe("5");
    expect(within(header).getByText("Nations").nextSibling?.textContent).toBe("16");
    expect(screen.queryByRole("heading", { name: /Your realms/ })).toBeNull();
  });

  it("offers Join a realm to a signed-in player with no nation", () => {
    auth = { isLoaded: true, isSignedIn: true };
    queries["realms.myNations"] = { activeCountryId: null, dividendCountryId: null, realms: [] };
    render(<RealmsLandingPage />);
    expect(screen.getByRole("link", { name: "Join a realm" }).getAttribute("href")).toBe(
      "#open-to-join"
    );
    expect(screen.queryByRole("link", { name: "Sign in to play" })).toBeNull();
  });

  it("sends a player with nations to their realms, each nation with Play as", () => {
    auth = { isLoaded: true, isSignedIn: true };
    queries["realms.directory"] = [{ ...EURTH, myNationCount: 2 }, QUIET];
    queries["realms.myNations"] = {
      activeCountryId: "n1",
      dividendCountryId: "n1",
      realms: [
        {
          id: "eurth",
          slug: "eurth",
          name: "Eurth",
          nations: [
            { id: "n1", name: "Aurelia", slug: "aurelia", flag: null },
            { id: "n2", name: "Borea", slug: "borea", flag: null },
          ],
        },
      ],
    };
    queries["users.getProfile"] = { countryId: "n2" };
    render(<RealmsLandingPage />);

    expect(screen.getByRole("link", { name: "Go to your realms" }).getAttribute("href")).toBe(
      "#your-realms"
    );
    const yours = screen.getByRole("region", { name: /Your realms/ });
    expect(within(yours).getByText("You hold 2 of 2")).toBeTruthy();
    expect(within(yours).getByRole("link", { name: "Eurth" }).getAttribute("href")).toBe(
      "/r/eurth"
    );
    // The profile's active nation wins over the (possibly stale) myNations one.
    fireEvent.click(within(yours).getByRole("button", { name: "Play as Aurelia" }));
    expect(mutate).toHaveBeenCalledWith({ countryId: "n1" });
    expect(within(yours).getByText("Active")).toBeTruthy();
  });
});

describe("realms landing search", () => {
  it("finds realms by tag and nations across open realms, with their realm and claim state", () => {
    queries["realms.searchNations"] = [
      {
        kind: "country",
        id: "c1",
        name: "Modernia",
        slug: "modernia",
        flag: null,
        claimable: false,
        realm: { id: "eurth", slug: "eurth", name: "Eurth" },
      },
      {
        kind: "page",
        id: "quiet:ixwiki:Modern Republic",
        name: "Modern Republic",
        slug: null,
        flag: null,
        claimable: true,
        realm: { id: "quiet", slug: "quiet", name: "Quietlands" },
      },
    ];
    render(<RealmsLandingPage />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search realms and nations" }), {
      target: { value: "modern" },
    });

    const realmHits = screen.getByRole("list", { name: "Matching realms" });
    expect(within(realmHits).getByText("Quietlands")).toBeTruthy();
    expect(within(realmHits).queryByText("Eurth")).toBeNull();

    expect(queryInputs["realms.searchNations"]?.at(-1)).toEqual({ query: "modern" });
    const nationHits = screen.getByRole("list", { name: "Matching nations" });
    expect(within(nationHits).getByRole("link", { name: "Modernia" }).getAttribute("href")).toBe(
      "/countries/modernia"
    );
    expect(within(nationHits).getByText("Claimed")).toBeTruthy();
    expect(
      within(nationHits).getByRole("link", { name: "Claim Modern Republic" }).getAttribute("href")
    ).toBe("/r/quiet/nations");
  });

  it("waits for two letters before searching nations", () => {
    render(<RealmsLandingPage />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search realms and nations" }), {
      target: { value: "e" },
    });
    expect(screen.getByText("Type at least 2 letters to find nations.")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Matching nations" })).toBeNull();
  });
});

describe("realms landing sections", () => {
  it("lists realms open to join with how many nations are available, linking to the Nations tab", () => {
    render(<RealmsLandingPage />);
    const open = screen.getByRole("region", { name: "Open to join" });
    expect(within(open).getByText("5 open")).toBeTruthy();
    expect(within(open).getByText("2 unclaimed nations · 3 nation pages to claim")).toBeTruthy();
    expect(
      within(open).getByRole("link", { name: "See the nations of Eurth" }).getAttribute("href")
    ).toBe("/r/eurth/nations");
    expect(within(open).queryByText("Quietlands")).toBeNull();
  });

  it("browses every realm, filters by tag, and keeps the feed panel", () => {
    render(<RealmsLandingPage />);
    const browse = screen.getByRole("region", { name: /Browse all realms/ });
    expect(within(browse).getByRole("link", { name: "Eurth" })).toBeTruthy();
    expect(within(browse).getByRole("link", { name: "Quietlands" })).toBeTruthy();

    fireEvent.click(within(browse).getByRole("button", { name: "Modern" }));
    expect(within(browse).queryByRole("link", { name: "Eurth" })).toBeNull();
    expect(within(browse).getByRole("link", { name: "Quietlands" })).toBeTruthy();

    expect(screen.getByRole("region", { name: "Realm feed" })).toBeTruthy();
    expect(screen.getByText("feed for all")).toBeTruthy();
  });

  it("reports each realm's forum activity and links to its Hub", () => {
    const lastPostAt = new Date("2026-09-29T12:00:00Z");
    queries["realms.directory"] = [
      { ...EURTH, board: { recentPosts: 5, lastPostAt } },
      { ...QUIET, board: { recentPosts: 0, lastPostAt: null } },
    ];
    render(<RealmsLandingPage />);
    const browse = screen.getByRole("region", { name: /Browse all realms/ });
    expect(within(browse).getByText(/^5 posts this week · last /)).toBeTruthy();
    expect(within(browse).getByText("No posts yet")).toBeTruthy();
    expect(within(browse).queryByText(/Board not opened/)).toBeNull();
    const forumLinks = within(browse).getAllByRole("link", { name: "Forum" });
    expect(forumLinks.map((l) => l.getAttribute("href"))).toEqual([
      "/thinkpages/r/eurth/hub",
      "/thinkpages/r/quiet/hub",
    ]);
    expect(within(browse).queryByRole("link", { name: "Board" })).toBeNull();
  });
});
