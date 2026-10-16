import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

interface QueryResult {
  data?: object | null;
  isLoading?: boolean;
  error?: { data?: { code: string } } | null;
  refetch?: jest.Mock;
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
        latestActivity: query("latestActivity"),
        trending: query("trending"),
        myStanding: query("myStanding"),
        navFlags: query("navFlags"),
        realms: query("realms"),
        category: query("category"),
        realmPanel: query("realmPanel"),
        navCounts: query("navCounts"),
        appeal: { useMutation: () => ({ mutateAsync: jest.fn(), isPending: false }) },
      },
      thinkpagesForumMod: { context: query("context") },
      thinkpages: { getThinktanks: query("thinktanks") },
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
    canStart: true,
    style: "ooc",
    threadCount: 8,
    postCount: 23,
    unreadThreads: 0,
    lastPostAt: new Date(),
    latest: {
      threadId: `t_${key}`,
      threadTitle: `Latest in ${key}`,
      authorUserId: "u1",
      authorPersonaId: null,
      importedAuthorName: null,
      at: new Date(),
      author: { name: "Heku", handle: "heku", avatarUrl: null, flagUrl: "/flags/caphiria.png" },
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

/** A board's row: the list item holding the board's own link (a string `name` matches the whole name). */
const rowOf = (name: string) => screen.getByRole("link", { name }).closest("li") as HTMLElement;

describe("Forums home: board list", () => {
  it("marks a board with unread threads with an UnreadMark (tint dot, N new), and nothing for a board with none", () => {
    set("categories", {
      data: [board("general", { unreadThreads: 3 }), board("rules", { unreadThreads: 0 })],
    });
    render(<ForumHome />);
    const general = rowOf("General");
    expect(within(general).getByText("3 new")).toHaveClass("text-footnote", "text-label-secondary");
    expect(general.querySelector(".bg-tint.rounded-full")).not.toBeNull();
    expect(within(rowOf("Rules")).queryByText(/ new$/)).toBeNull();
  });

  it("lists each board with its link, description, counts and its last post", () => {
    set("categories", { data: [board("general"), board("announcements")] });
    render(<ForumHome />);
    expect(screen.getByRole("heading", { level: 1, name: "ThinkPages" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader")).toBeNull();
    const general = rowOf("General");
    expect(within(general).getByRole("link", { name: "General" })).toHaveAttribute(
      "href",
      "/thinkpages/c/general"
    );
    expect(within(general).getByText("general talk")).toBeInTheDocument();
    expect(within(general).getByText("8")).toBeInTheDocument();
    expect(within(general).getByText("23")).toBeInTheDocument();
    expect(within(general).getByText("8 threads · 23 posts")).toHaveClass("md:hidden");
    expect(within(general).getByRole("link", { name: "Latest in general" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t_general"
    );
    expect(general.querySelector('img[src="/flags/caphiria.png"]')).toBeNull();
    expect(rowOf("Announcements")).toBeInTheDocument();
  });

  it("says 0 threads, 0 posts and No threads yet for an empty board, never a dash", () => {
    set("categories", { data: [EMPTY_BOARD] });
    render(<ForumHome />);
    const row = rowOf("Rules");
    expect(within(row).getByText("0 threads · 0 posts")).toBeInTheDocument();
    expect(within(row).getByText("No threads yet")).toBeInTheDocument();
    expect(within(row).getAllByRole("link")).toHaveLength(1);
    expect(within(row).queryByText("–")).toBeNull();
  });

  it("sets each board as a rich row: a textured tint icon tile, a list-size name, its description, counts with units", () => {
    set("categories", { data: [board("general")] });
    render(<ForumHome />);
    const row = rowOf("General");
    const tile = row.querySelector("span[aria-hidden]")!;
    expect(tile).toHaveClass("bg-tint-fill", "text-tint", "size-12");
    expect(tile.querySelector(".texture-overlay.facet-texture-paper-grain")).not.toBeNull();
    expect(within(row).getByRole("heading", { level: 3, name: /General/ })).toHaveClass(
      "text-title-3"
    );
    expect(within(row).getByText("general talk")).toHaveClass("text-callout");
    expect(within(row).getByText("threads")).toBeInTheDocument();
    expect(within(row).getByText("posts")).toBeInTheDocument();
  });

  it("names the persona, not the player, for a persona's latest post, and shows no flag", () => {
    const latest = {
      ...board("general").latest,
      authorUserId: null,
      authorPersonaId: "pa",
      author: { name: "Caphiria News", handle: "caphnews", avatarUrl: null, flagUrl: null },
    };
    set("categories", { data: [board("general", { latest })] });
    render(<ForumHome />);
    expect(screen.getByText(/Caphiria News/)).toBeInTheDocument();
    expect(screen.queryByText(/Heku/)).toBeNull();
    expect(rowOf("General").querySelector("img")).toBeNull();
  });

  it("marks staff-only boards with a Staff pill, and only those", () => {
    set("categories", {
      data: [board("staff", { visibility: "staff" }), board("general")],
    });
    render(<ForumHome />);
    const pill = { selector: '[data-slot="badge"]' };
    expect(within(rowOf("Staff")).getByText("Staff", pill)).toBeInTheDocument();
    expect(within(rowOf("General")).queryByText("Staff", pill)).toBeNull();
  });

  it("says there are no boards when none is visible, over a textured pane", () => {
    set("categories", { data: [] });
    const { container } = render(<ForumHome />);
    expect(screen.getByText("No boards yet")).toBeInTheDocument();
    expect(container.querySelector(".facet-texture-grid")).not.toBeNull();
  });

  it("offers a retry, not 'No boards yet', when the boards fail to load", () => {
    const refetch = jest.fn();
    set("categories", {
      data: undefined,
      error: { data: { code: "INTERNAL_SERVER_ERROR" } },
      refetch,
    });
    render(<ForumHome />);
    expect(screen.queryByText("No boards yet")).toBeNull();
    expect(screen.getByText("Could not load this page")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the boards it has when a refetch fails", () => {
    set("categories", {
      data: [board("general")],
      error: { data: { code: "INTERNAL_SERVER_ERROR" } },
    });
    render(<ForumHome />);
    expect(screen.getByRole("link", { name: "General" })).toBeInTheDocument();
    expect(screen.queryByText("Could not load this page")).toBeNull();
  });

  it("shows a skeleton while the boards load", () => {
    set("categories", { isLoading: true });
    render(<ForumHome />);
    expect(screen.queryByRole("link", { name: "General" })).toBeNull();
  });
});

describe("Forums home: New thread menu", () => {
  const open = () => {
    const trigger = screen.getByRole("button", { name: "New thread" });
    fireEvent.keyDown(trigger, { key: "Enter" });
  };

  it("offers New thread as a menu of the boards the viewer can start one in", () => {
    set("categories", {
      data: [board("general", { canStart: true }), board("rules", { canStart: false })],
    });
    render(<ForumHome />);
    open();
    expect(screen.getByRole("menuitem", { name: "General" })).toHaveAttribute(
      "href",
      "/thinkpages/c/general/new"
    );
    expect(screen.queryByRole("menuitem", { name: "Rules" })).toBeNull();
  });

  it("shows no New thread menu when the viewer can start a thread nowhere", () => {
    set("categories", { data: [board("rules", { canStart: false })] });
    render(<ForumHome />);
    expect(screen.queryByRole("button", { name: "New thread" })).toBeNull();
  });
});

describe("Forums home: texture and character", () => {
  it("tops the page with a plain header whose subtitle totals the sitewide boards", () => {
    set("categories", {
      data: [board("general"), board("announcements", { threadCount: 2, postCount: 7 })],
    });
    render(<ForumHome />);
    const header = screen.getByRole("heading", { level: 1, name: "ThinkPages" }).closest("header")!;
    expect(within(header).getByText("2 boards · 10 threads · 30 posts")).toBeInTheDocument();
  });

  it("has no textured masthead and no grain on the page canvas", () => {
    set("categories", { data: [board("rules")] });
    const { container } = render(<ForumHome />);
    const header = screen.getByRole("heading", { level: 1, name: "ThinkPages" }).closest("header")!;
    expect(header.querySelector(".texture-overlay")).toBeNull();
    const outside = [...container.querySelectorAll(".texture-overlay")].filter(
      (texture) => !texture.closest('[data-slot="card"]') && !texture.closest("span[aria-hidden]")
    );
    expect(outside).toEqual([]);
  });

  it("gives each board its own texture on a large tile", () => {
    set("categories", {
      data: [board("rules"), board("announcements"), board("find-a-realm"), board("general")],
    });
    render(<ForumHome />);
    const texture = (name: string) =>
      rowOf(name).querySelector("span[aria-hidden] .texture-overlay")!.className;
    expect(texture("Rules")).toContain("facet-texture-grid");
    expect(texture("Announcements")).toContain("facet-texture-chevron");
    expect(texture("Find-a-realm")).toContain("facet-texture-dots");
    expect(texture("General")).toContain("facet-texture-paper-grain");
  });

  it("shows each board's last post as an inline column: the thread, then who and when", () => {
    set("categories", { data: [board("general")] });
    render(<ForumHome />);
    const row = rowOf("General");
    const link = within(row).getByRole("link", { name: "Latest in general" });
    expect(link).toHaveAttribute("href", "/thinkpages/t/t_general");
    expect(row.querySelector('[data-slot="card"]')).toBeNull();
    expect(within(row).getByText(/Heku · /)).toBeInTheDocument();
  });

  it("says No threads yet in the column for an empty board", () => {
    set("categories", { data: [EMPTY_BOARD] });
    render(<ForumHome />);
    expect(screen.getByText("No threads yet")).toBeInTheDocument();
  });

  it("sets the name of a board with new threads in semibold, and only that board", () => {
    set("categories", {
      data: [board("general", { unreadThreads: 2 }), board("rules", { unreadThreads: 0 })],
    });
    render(<ForumHome />);
    expect(screen.getByRole("link", { name: "General" })).toHaveClass("font-semibold");
    expect(screen.getByRole("link", { name: "General" })).not.toHaveClass("font-medium");
    expect(screen.getByRole("link", { name: "Rules" })).toHaveClass("font-medium");
    expect(screen.getByRole("link", { name: "Rules" })).not.toHaveClass("font-semibold");
    expect(rowOf("General").className).not.toContain("before:");
    const name = screen.getByRole("link", { name: "General" });
    const dot = rowOf("General").querySelector(".bg-tint.rounded-full") as HTMLElement;
    expect(name.compareDocumentPosition(dot) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    const count = screen.getByText("2 new");
    expect(name.compareDocumentPosition(count) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
  const message = (over: object = {}) => ({
    id: "m1",
    author: { name: "Kir", avatarUrl: null, flagUrl: "/flags/kir.png", persona: false },
    excerpt: "The envoys land on Friday",
    createdAt: new Date(Date.now() - 3 * 60_000),
    href: "/thinkpages/r/eurth#post-m1",
    ...over,
  });
  const panel = (messages: object[] = [message()]) => ({
    realm: { slug: "eurth", name: "Eurth", emblemUrl: null, thumbnail: null },
    messages,
  });
  const member = () => {
    auth.isSignedIn = true;
    set("navFlags", { data: { realmMember: true, forumModerator: false } });
  };

  beforeEach(() => {
    set("categories", { data: [board("general")] });
  });

  it("says how many messages are new on the realm board, and nothing when none are", () => {
    auth.isSignedIn = true;
    set("navFlags", { data: { realmMember: true, forumModerator: false } });
    set("realmPanel", { data: panel() });
    set("navCounts", { data: { watchedUnread: 0, realmBoardNew: 4 } });
    const { unmount } = render(<ForumHome />);
    const link = screen.getByRole("link", { name: /Eurth/ });
    expect(link).toHaveTextContent("4 new on the board");
    const name = within(link).getByText("Eurth");
    const dot = link.querySelector(".bg-tint.rounded-full") as HTMLElement;
    expect(name).toHaveClass("font-semibold");
    expect(name.compareDocumentPosition(dot) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(
      name.compareDocumentPosition(within(link).getByText("4 new on the board")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    unmount();

    set("navCounts", { data: { watchedUnread: 0, realmBoardNew: 0 } });
    render(<ForumHome />);
    expect(screen.queryByText(/ new$/)).toBeNull();
  });

  it("caps the realm board count at 99+", () => {
    auth.isSignedIn = true;
    set("navFlags", { data: { realmMember: true, forumModerator: false } });
    set("realmPanel", { data: panel() });
    set("navCounts", { data: { watchedUnread: 0, realmBoardNew: 100 } });
    render(<ForumHome />);
    expect(screen.getByText("99+ new on the board")).toBeInTheDocument();
  });

  it("shows the viewer's realm with its newest board message, linking to /thinkpages/r/mine", () => {
    member();
    set("realmPanel", { data: panel() });
    render(<ForumHome />);
    const card = screen.getByRole("link", { name: /Eurth/ });
    expect(card).toHaveAttribute("href", "/thinkpages/r/mine");
    expect(within(card).getByText("Kir")).toBeInTheDocument();
    expect(within(card).getByText("The envoys land on Friday")).toBeInTheDocument();
    expect(within(card).getByText("3m ago")).toBeInTheDocument();
    expect(card.querySelector('img[src="/flags/kir.png"]')).toBeNull();
    expect(screen.getByText("Your realm")).toBeInTheDocument();
  });

  it("names the persona, not the player, on a persona's newest board message, and shows no flag", () => {
    member();
    const author = { name: "Aria Vance", avatarUrl: null, flagUrl: null, persona: true };
    set("realmPanel", { data: panel([message({ author })]) });
    render(<ForumHome />);
    const card = screen.getByRole("link", { name: /Eurth/ });
    expect(within(card).getByText("Aria Vance")).toBeInTheDocument();
    expect(card.querySelector("img")).toBeNull();
  });

  it("shows no message line when the board has no messages", () => {
    member();
    set("realmPanel", { data: panel([]) });
    render(<ForumHome />);
    const card = screen.getByRole("link", { name: /Eurth/ });
    expect(card).toHaveTextContent(/^Eurth$/);
  });

  it("holds the card with a placeholder while the realm loads, so the boards do not jump", () => {
    member();
    set("realmPanel", { isLoading: true });
    render(<ForumHome />);
    expect(screen.getByRole("heading", { level: 2, name: "Your realm" })).toBeInTheDocument();
    expect(screen.getByTestId("your-realm-placeholder")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Eurth/ })).toBeNull();
  });

  it("shows nothing once the board has loaded to no realm", () => {
    member();
    set("realmPanel", { data: null });
    render(<ForumHome />);
    expect(screen.queryByText("Your realm")).toBeNull();
  });

  it("puts Your realm in the main column above the boards, not in the rail", () => {
    auth.isSignedIn = true;
    set("navFlags", { data: { realmMember: true, forumModerator: false } });
    set("realmPanel", { data: panel() });
    set("trending", {
      data: [{ threadId: "t1", title: "A", categoryName: "Hub", repliesToday: 1 }],
    });
    render(<ForumHome />);
    const heading = screen.getByRole("heading", { level: 2, name: "Your realm" });
    expect(heading.closest('[data-slot="inspector"]')).toBeNull();
    expect(heading.closest("aside")).toBeNull();
    expect(
      heading.compareDocumentPosition(screen.getByRole("heading", { level: 2, name: "Sitewide" })) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    const rail = document.querySelector('[data-slot="inspector"]') as HTMLElement;
    expect(within(rail).queryByRole("heading", { name: "Your realm" })).toBeNull();
    expect(within(rail).getByRole("heading", { level: 2, name: /Trending/ })).toBeInTheDocument();
  });

  it("draws the realm's uploaded emblem in Your realm, else its thumbnail, else the realms icon", () => {
    auth.isSignedIn = true;
    set("realmPanel", { data: panel() });
    const mark = { slug: "eurth", name: "Eurth", emblemUrl: null, thumbnail: null };
    const tile = () => screen.getByRole("link", { name: /Eurth/ });

    set("navFlags", {
      data: {
        realmMember: true,
        forumModerator: false,
        realm: {
          ...mark,
          emblemUrl: "https://img.example/e.png",
          thumbnail: "https://img.example/t.png",
        },
      },
    });
    const { unmount } = render(<ForumHome />);
    expect(tile().querySelector("img")).toHaveAttribute("src", "https://img.example/e.png");
    unmount();

    set("navFlags", {
      data: {
        realmMember: true,
        forumModerator: false,
        realm: { ...mark, thumbnail: "https://img.example/t.png" },
      },
    });
    const second = render(<ForumHome />);
    expect(tile().querySelector("img")).toHaveAttribute("src", "https://img.example/t.png");
    second.unmount();

    set("navFlags", { data: { realmMember: true, forumModerator: false, realm: mark } });
    render(<ForumHome />);
    expect(tile().querySelector("img")).toBeNull();
    expect(tile().querySelector("svg")).not.toBeNull();
  });

  it("omits the card for a viewer without a realm, and signed out", () => {
    auth.isSignedIn = true;
    set("navFlags", { data: { realmMember: false, forumModerator: false } });
    set("realmPanel", { data: panel() });
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

  it("shows Latest activity: who posted, started or replied in which thread, linking to the post", () => {
    set("latestActivity", {
      data: [
        {
          postId: "p2",
          threadId: "t1",
          threadTitle: "Lore Lab",
          categoryName: "General",
          isFirstPost: false,
          at: new Date(),
          authorUserId: "u1",
          authorPersonaId: null,
          importedAuthorName: null,
          author: { name: "Kir", handle: "kir", avatarUrl: null, flagUrl: "/flags/kir.png" },
        },
        {
          postId: "p1",
          threadId: "t2",
          threadTitle: "New realm",
          categoryName: "Hub",
          isFirstPost: true,
          at: new Date(),
          authorUserId: null,
          authorPersonaId: "pa",
          importedAuthorName: null,
          author: { name: "Aria Vance", handle: "aria", avatarUrl: null, flagUrl: null },
        },
      ],
    });
    render(<ForumHome />);
    const panel = screen.getByText("Latest activity").closest('[data-slot="card"]') as HTMLElement;
    const reply = within(panel).getByRole("link", { name: /Kir replied in Lore Lab/ });
    expect(reply).toHaveAttribute("href", "/thinkpages/post/p2");
    expect(reply.querySelector('img[src="/flags/kir.png"]')).not.toBeNull();
    expect(
      within(panel).getByRole("link", { name: /Aria Vance started New realm/ })
    ).toBeInTheDocument();
    expect(within(panel).getByText(/^Hub · /)).toBeInTheDocument();
  });

  it("shows Trending threads, ranked, and hides the panel when nothing is active", () => {
    set("trending", {
      data: [
        { threadId: "t1", title: "Realm Board archive", categoryName: "Hub", repliesToday: 4 },
        { threadId: "t2", title: "Lore Lab", categoryName: "General", repliesToday: 1 },
      ],
    });
    const { unmount } = render(<ForumHome />);
    const trending = screen
      .getByText("Trending threads")
      .closest('[data-slot="card"]') as HTMLElement;
    expect(within(trending).getByRole("link", { name: /Realm Board archive/ })).toHaveAttribute(
      "href",
      "/thinkpages/t/t1"
    );
    expect(within(trending).getByText("Hub · 4 replies today")).toBeInTheDocument();
    expect(within(trending).getByText("General · 1 reply today")).toBeInTheDocument();
    unmount();

    set("trending", { data: [] });
    render(<ForumHome />);
    expect(screen.queryByText("Trending threads")).toBeNull();
  });

  it("no longer shows Forum statistics", () => {
    set("trending", {
      data: [{ threadId: "t1", title: "A", categoryName: "Hub", repliesToday: 1 }],
    });
    render(<ForumHome />);
    expect(screen.queryByText("Forum statistics")).toBeNull();
  });

  it("lists up to three open realm adverts in Find a Realm, leaving out locked and closed ones", () => {
    const advert = (id: string, realmName: string, extra: object = {}) => ({
      id,
      title: `${realmName} is recruiting`,
      locked: false,
      advert: { realmSlug: id, realmName, emblemUrl: null, thumbnail: null, claimsOpen: true },
      ...extra,
    });
    set("category", {
      data: {
        threads: [
          advert("a1", "Eurth"),
          advert("a2", "Locked Realm", { locked: true }),
          advert("a3", "Closed Realm", {
            advert: {
              realmSlug: "a3",
              realmName: "Closed Realm",
              emblemUrl: null,
              thumbnail: null,
              claimsOpen: false,
            },
          }),
          { id: "plain", title: "An old thread", locked: false, advert: null },
          advert("a4", "Ixnay"),
          advert("a5", "Urcea"),
          advert("a6", "Fourth"),
        ],
        authors: { users: {}, personas: {} },
      },
    });
    render(<ForumHome />);
    const panel = screen.getByText("Find a Realm").closest('[data-slot="card"]') as HTMLElement;
    expect(within(panel).getByRole("link", { name: /Eurth/ })).toHaveAttribute(
      "href",
      "/thinkpages/t/a1"
    );
    expect(within(panel).queryByText("Locked Realm")).toBeNull();
    expect(within(panel).queryByText("Closed Realm")).toBeNull();
    expect(within(panel).queryByText("An old thread")).toBeNull();
    expect(within(panel).queryByText("Fourth")).toBeNull();
    expect(within(panel).getByRole("link", { name: /All realms recruiting/ })).toHaveAttribute(
      "href",
      "/thinkpages/c/find-a-realm"
    );
  });

  it("lists ThinkTanks, most recently active first, with a way to all of them", () => {
    const tank = (id: string, name: string, lastActivity: Date) => ({
      id,
      name,
      avatar: null,
      lastActivity,
      _count: { members: 3 },
    });
    set("thinktanks", {
      data: [
        tank("g1", "Old Tank", new Date("2026-01-01T00:00:00Z")),
        tank("g2", "Busy Tank", new Date()),
      ],
    });
    render(<ForumHome />);
    const panel = screen
      .getByRole("heading", { name: "ThinkTanks" })
      .closest('[data-slot="card"]') as HTMLElement;
    const links = within(panel).getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/thinktanks/g2");
    expect(links[1]).toHaveAttribute("href", "/thinktanks/g1");
    expect(within(panel).getAllByText(/^3 members · /)).toHaveLength(2);
    expect(within(panel).getByRole("link", { name: /All ThinkTanks/ })).toHaveAttribute(
      "href",
      "/thinktanks"
    );
  });

  it("lists only the member's own as Your ThinkTanks when they belong to some", () => {
    auth.isSignedIn = true;
    set("thinktanks", {
      data: [
        {
          id: "g1",
          name: "Mine",
          avatar: null,
          lastActivity: new Date("2026-01-01T00:00:00Z"),
          isMember: true,
          _count: { members: 1 },
        },
        {
          id: "g2",
          name: "Not mine",
          avatar: null,
          lastActivity: new Date(),
          isMember: false,
          _count: { members: 9 },
        },
      ],
    });
    render(<ForumHome />);
    const panel = screen
      .getByRole("heading", { name: "Your ThinkTanks" })
      .closest('[data-slot="card"]') as HTMLElement;
    expect(within(panel).getByText(/^1 member · /)).toBeInTheDocument();
    expect(within(panel).queryByText("Not mine")).toBeNull();
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
