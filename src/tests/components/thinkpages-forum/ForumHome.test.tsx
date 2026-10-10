import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

interface QueryResult {
  data?: object | null;
  isLoading?: boolean;
  error?: { data?: { code: string } } | null;
}

interface MockApi {
  results: Record<string, QueryResult>;
  inputs: Record<string, unknown>;
}

jest.mock("~/trpc/react", () => {
  const results: Record<string, QueryResult> = {};
  const inputs: Record<string, unknown> = {};
  const query = (name: string) => ({
    useQuery: (input?: unknown) => {
      inputs[name] = input;
      return { isLoading: false, error: null, ...results[name] };
    },
  });
  const invalidate = { invalidate: () => Promise.resolve() };
  return {
    results,
    inputs,
    api: {
      useUtils: () => ({ thinkpagesForum: { myStanding: invalidate } }),
      thinkpagesForum: {
        categories: query("categories"),
        forumStats: query("forumStats"),
        trending: query("trending"),
        myStanding: query("myStanding"),
        navFlags: query("navFlags"),
        realms: query("realms"),
        category: query("category"),
        appeal: { useMutation: () => ({ mutateAsync: jest.fn(), isPending: false }) },
      },
      thinkpagesForumMod: { context: query("context") },
    },
  };
});

jest.mock("next/navigation", () => {
  const router = { push: jest.fn(), replace: jest.fn() };
  return { router, useRouter: () => router, usePathname: () => "/thinkpages" };
});

jest.mock("~/context/auth-context", () => {
  const auth = { isSignedIn: false };
  return { auth, useUser: () => ({ user: null, isSignedIn: auth.isSignedIn }) };
});

import { ForumHome } from "~/components/thinkpages-forum/home";

const { results } = jest.requireMock<MockApi>("~/trpc/react");
const { auth } = jest.requireMock<{ auth: { isSignedIn: boolean } }>("~/context/auth-context");

const originalMatchMedia = window.matchMedia;

/** The Inspector shows its children from 1280px; narrower they live in a closed sheet. */
function installViewport(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query === "(min-width: 1280px)" ? wide : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function board(key: string, extra: object = {}) {
  return {
    id: `cat_${key}`,
    key,
    name: key[0]!.toUpperCase() + key.slice(1),
    description: `${key} talk`,
    icAllowed: false,
    postRole: "any",
    visibility: "public",
    style: "ooc",
    threadCount: 8,
    postCount: 23,
    lastPostAt: new Date(),
    latest: {
      threadId: `t_${key}`,
      threadTitle: `Latest in ${key}`,
      authorUserId: "u1",
      authorPersonaId: null,
      importedAuthorName: null,
      at: new Date(),
      author: { name: "Heku", handle: "heku" },
    },
    ...extra,
  };
}

const EMPTY_BOARD = board("rules", {
  threadCount: 0,
  postCount: 0,
  lastPostAt: null,
  latest: null,
});

function set(name: string, result: QueryResult) {
  results[name] = result;
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(results)) delete results[key];
  auth.isSignedIn = false;
  installViewport(true);
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("Forums home: board table", () => {
  it("lists boards under Board / Threads / Posts / Latest, each row linking to its board", () => {
    set("categories", { data: [board("general"), board("announcements")] });
    render(<ForumHome />);
    expect(screen.getByRole("heading", { level: 1, name: "ThinkPages" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Board",
      "Threads",
      "Posts",
      "Latest",
    ]);
    const general = screen.getByRole("row", { name: /General/ });
    expect(within(general).getByRole("link", { name: "General" })).toHaveAttribute(
      "href",
      "/thinkpages/c/general"
    );
    expect(within(general).getByText("general talk")).toBeInTheDocument();
    expect(within(general).getByText("8")).toBeInTheDocument();
    expect(within(general).getByText("23")).toBeInTheDocument();
    expect(within(general).getByText("Latest in general")).toBeInTheDocument();
    expect(within(general).getByText(/Heku/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Announcements/ })).toHaveAttribute(
      "href",
      "/thinkpages/c/announcements"
    );
  });

  it("gives each row one cell per column, so counts sit under their headers", () => {
    set("categories", { data: [board("general")] });
    render(<ForumHome />);
    const row = screen.getByRole("row", { name: /General/ });
    const cells = within(row).getAllByRole("cell");
    expect(cells).toHaveLength(4);
    expect(within(cells[1]!).getByText("8")).toBeInTheDocument();
    expect(within(cells[2]!).getByText("23")).toBeInTheDocument();
    expect(within(cells[3]!).getByText("Latest in general")).toBeInTheDocument();
    expect(within(row).getAllByRole("link")).toHaveLength(1);
  });

  it("shows a dash, read as None, for an empty board's threads, posts and latest", () => {
    set("categories", { data: [EMPTY_BOARD] });
    render(<ForumHome />);
    const row = screen.getByRole("row", { name: /Rules/ });
    expect(within(row).getAllByText("–")).toHaveLength(3);
    expect(within(row).getAllByText("None")).toHaveLength(3);
  });

  it("names the persona, not the player, for a persona's latest post", () => {
    const latest = {
      ...board("general").latest,
      authorUserId: null,
      authorPersonaId: "pa",
      author: { name: "Caphiria News", handle: "caphnews" },
    };
    set("categories", { data: [board("general", { latest })] });
    render(<ForumHome />);
    expect(screen.getByText(/Caphiria News/)).toBeInTheDocument();
    expect(screen.queryByText(/Heku/)).toBeNull();
  });

  it("marks staff-only boards with a Staff pill, and only those", () => {
    set("categories", {
      data: [board("staff", { visibility: "staff" }), board("general")],
    });
    render(<ForumHome />);
    const pill = { selector: '[data-slot="badge"]' };
    expect(
      within(screen.getByRole("row", { name: /Staff/ })).getByText("Staff", pill)
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /General/ })).queryByText("Staff", pill)
    ).toBeNull();
  });

  it("says there are no boards when none is visible", () => {
    set("categories", { data: [] });
    render(<ForumHome />);
    expect(screen.getByText("No boards yet")).toBeInTheDocument();
  });

  it("shows a skeleton while the boards load", () => {
    set("categories", { isLoading: true });
    render(<ForumHome />);
    expect(screen.queryByRole("columnheader")).toBeNull();
  });
});

describe("Forums home: the old forum's archive", () => {
  const archive = (key: string, name: string) => board(key, { name });

  it("collapses the archive under From the old forum, after the sitewide table", () => {
    set("categories", {
      data: [archive("xf-12", "Old Roleplay"), board("general"), archive("xf-3", "Old Chat")],
    });
    render(<ForumHome />);
    const trigger = screen.getByRole("button", { name: /From the old forum/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: /Old Roleplay/ })).toBeNull();
    expect(screen.getByRole("link", { name: /General/ })).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole("link", { name: /Old Roleplay/ })).toHaveAttribute(
      "href",
      "/thinkpages/c/xf-12"
    );
    expect(screen.getByRole("link", { name: /Old Chat/ })).toBeInTheDocument();
    const heading = screen.getByRole("heading", { level: 2, name: /From the old forum/ });
    expect(
      screen.getByRole("link", { name: /General/ }).compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("has no archive group without archive boards", () => {
    set("categories", { data: [board("general")] });
    render(<ForumHome />);
    expect(screen.queryByText(/From the old forum/)).toBeNull();
  });

  it("shows only the archive group when nothing else is visible", () => {
    set("categories", { data: [archive("xf-12", "Old Roleplay")] });
    render(<ForumHome />);
    expect(screen.getByRole("button", { name: /From the old forum/ })).toBeInTheDocument();
    expect(screen.queryByText("No boards yet")).toBeNull();
  });
});

describe("Forums home: Your realm and Moderation", () => {
  const realm = { defaultSlug: "eurth", realms: [{ id: "r1", slug: "eurth", name: "Eurth" }] };
  const hub = {
    category: { key: "hub", name: "Hub" },
    threads: [
      {
        id: "t_old",
        title: "Pinned rules",
        pinned: true,
        authorUserId: "u1",
        authorPersonaId: null,
        importedAuthorName: null,
        lastPostAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: "t_hub",
        title: "Interregnum topics",
        pinned: false,
        authorUserId: "u2",
        authorPersonaId: "pa",
        importedAuthorName: null,
        lastPostAt: new Date(),
      },
    ],
    authors: {
      users: {
        u1: { name: "Kir", handle: "kir", avatarUrl: null, flagUrl: null },
        u2: { name: "Hidden Player", handle: null, avatarUrl: null, flagUrl: null },
      },
      personas: { pa: { displayName: "Aria Vance", username: "aria", avatarUrl: null } },
    },
  };

  beforeEach(() => {
    set("categories", { data: [board("general")] });
  });

  it("shows the viewer's realm with its Hub's latest thread, linking to /thinkpages/r/mine", () => {
    auth.isSignedIn = true;
    set("navFlags", { data: { realmMember: true, forumModerator: false } });
    set("realms", { data: realm });
    set("category", { data: hub });
    render(<ForumHome />);
    const card = screen.getByRole("link", { name: /Eurth/ });
    expect(card).toHaveAttribute("href", "/thinkpages/r/mine");
    expect(within(card).getByText("Interregnum topics")).toBeInTheDocument();
    expect(within(card).getByText(/Aria Vance/)).toBeInTheDocument();
    expect(within(card).queryByText(/Hidden Player/)).toBeNull();
    expect(screen.getByText("Your realm")).toBeInTheDocument();
  });

  it("omits the card for a viewer without a realm, and signed out", () => {
    auth.isSignedIn = true;
    set("navFlags", { data: { realmMember: false, forumModerator: false } });
    set("realms", { data: realm });
    const { unmount } = render(<ForumHome />);
    expect(screen.queryByText("Your realm")).toBeNull();
    unmount();

    auth.isSignedIn = false;
    set("navFlags", { data: { realmMember: true, forumModerator: false } });
    render(<ForumHome />);
    expect(screen.queryByText("Your realm")).toBeNull();
  });

  it("offers Moderation to anyone who moderates something, else nothing", () => {
    auth.isSignedIn = true;
    const none = { isSiteAdmin: false, realms: [], categories: [] };
    set("context", { data: { ...none, realms: [{ id: "r1", slug: "eurth", name: "Eurth" }] } });
    const { unmount } = render(<ForumHome />);
    expect(screen.getByRole("link", { name: "Moderation" })).toHaveAttribute(
      "href",
      "/thinkpages/mod"
    );
    unmount();

    set("context", { data: none });
    render(<ForumHome />);
    expect(screen.queryByRole("link", { name: "Moderation" })).toBeNull();
  });
});

describe("Forums home: rail", () => {
  beforeEach(() => {
    set("categories", { data: [board("general")] });
  });

  it("shows Trending threads and Forum statistics", () => {
    set("trending", {
      data: [
        { threadId: "t1", title: "Realm Board archive", categoryName: "Hub", repliesToday: 4 },
        { threadId: "t2", title: "Lore Lab", categoryName: "General", repliesToday: 1 },
      ],
    });
    set("forumStats", { data: { threads: 48, posts: 1730, members: 31 } });
    render(<ForumHome />);
    const trending = screen
      .getByText("Trending threads")
      .closest('[data-slot="card"]') as HTMLElement;
    expect(within(trending).getByRole("link", { name: /Realm Board archive/ })).toHaveAttribute(
      "href",
      "/thinkpages/t/t1"
    );
    expect(within(trending).getByText("Hub · 4 replies today")).toBeInTheDocument();
    expect(within(trending).getByText("General · 1 reply today")).toBeInTheDocument();

    const stats = screen.getByText("Forum statistics").closest('[data-slot="card"]') as HTMLElement;
    expect(within(stats).getByText("48")).toHaveClass("text-title-2", "text-tint", "tabular-nums");
    expect(within(stats).getByText("1,730")).toBeInTheDocument();
    expect(within(stats).getByText("Members")).toBeInTheDocument();
  });

  it("hides an empty Trending panel but keeps the statistics", () => {
    set("trending", { data: [] });
    set("forumStats", { data: { threads: 1, posts: 2, members: 3 } });
    render(<ForumHome />);
    expect(screen.queryByText("Trending threads")).toBeNull();
    expect(screen.getByText("Forum statistics")).toBeInTheDocument();
  });

  it("renders no rail, and no Info button, when no panel has content", () => {
    set("trending", { data: [] });
    const { container } = render(<ForumHome />);
    expect(container.querySelector('[data-slot="inspector"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Info" })).toBeNull();
  });

  it("puts Your standing in the rail for a member with warnings, as the anchor ban notices link to", () => {
    auth.isSignedIn = true;
    set("myStanding", {
      data: {
        activePoints: 2,
        warnings: [
          {
            id: "w1",
            points: 2,
            reason: "Flaming",
            createdAt: new Date(),
            expiresAt: new Date("2026-12-30T00:00:00Z"),
            revokedAt: null,
            appeal: null,
            canAppeal: true,
          },
        ],
        bans: [],
        appeals: [],
      },
    });
    const { container } = render(<ForumHome />);
    expect(screen.getByRole("heading", { name: "Your standing" })).toBeInTheDocument();
    expect(container.querySelector("#standing")).not.toBeNull();
    expect(screen.getByText("Flaming")).toBeInTheDocument();
  });

  it("leaves Your standing out for a member in good standing", () => {
    auth.isSignedIn = true;
    set("myStanding", { data: { activePoints: 0, warnings: [], bans: [], appeals: [] } });
    render(<ForumHome />);
    expect(screen.queryByText("Your standing")).toBeNull();
  });
});
