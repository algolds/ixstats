import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

interface QueryResult {
  data?: object | null;
  isLoading?: boolean;
  error?: { data?: { code: string } } | null;
  refetch?: jest.Mock;
}

interface MockApi {
  results: Record<string, QueryResult>;
  inputs: Record<string, object | undefined>;
  mutations: Record<string, jest.Mock>;
}

jest.mock("~/trpc/react", () => {
  const results: Record<string, QueryResult> = {};
  const inputs: Record<string, object | undefined> = {};
  const mutations: Record<string, jest.Mock> = {};
  const query = (name: string) => ({
    useQuery: (input?: object) => {
      inputs[name] = input;
      return { isLoading: false, error: null, ...results[name] };
    },
  });
  const mutation = (name: string) => ({
    useMutation: () => ({ mutateAsync: mutations[name], mutate: jest.fn(), isPending: false }),
  });
  return {
    results,
    inputs,
    mutations,
    api: {
      wikios: { getMissingPages: { useQuery: () => ({ data: undefined }) } },
      // The persona's hover card loads its profile only when opened.
      thinkpages: {
        getAccountProfile: { useQuery: () => ({ data: undefined, isLoading: false }) },
      },
      useUtils: () => ({
        thinkpagesForum: {
          thread: { invalidate: () => Promise.resolve() },
          category: { invalidate: () => Promise.resolve() },
          categories: { invalidate: () => Promise.resolve() },
          realmSection: { invalidate: () => Promise.resolve() },
          myStanding: { invalidate: () => Promise.resolve() },
          resolvePost: { fetch: () => Promise.resolve({ threadId: "t1", page: 3 }) },
        },
        thinkpagesForumMod: { context: { invalidate: () => Promise.resolve() } },
      }),
      thinkpagesForum: {
        categories: query("categories"),
        realms: query("realms"),
        forumStats: query("forumStats"),
        trending: query("trending"),
        navFlags: query("navFlags"),
        category: query("category"),
        thread: query("thread"),
        reply: mutation("reply"),
        editPost: mutation("editPost"),
        createThread: mutation("createThread"),
        report: mutation("report"),
        myStanding: query("myStanding"),
        appeal: mutation("appeal"),
      },
      thinkpagesForumMod: {
        context: query("context"),
        setThreadFlag: mutation("setThreadFlag"),
        moveThread: mutation("moveThread"),
        setPostHidden: mutation("setPostHidden"),
        editPost: mutation("modEditPost"),
        warn: mutation("warn"),
        ban: mutation("ban"),
      },
      // useThreadActionCards batches through useQueries; no post here holds a token.
      useQueries: (_queries: unknown, opts: { combine: (results: never[]) => unknown }) =>
        opts.combine([]),
    },
  };
});

jest.mock("next/navigation", () => {
  const router = { push: jest.fn(), replace: jest.fn() };
  return {
    router,
    useRouter: () => router,
    usePathname: () => "/thinkpages/c/general",
    redirect: jest.fn(),
  };
});

jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));

interface ComposerStubProps {
  submitLabel?: string;
  initialHtml?: string;
  onSubmit: (input: { html: string; personaId: string | null; title?: string }) => Promise<void>;
}

jest.mock("~/components/thinkpages-forum/composer", () =>
  jest.requireActual("~/tests/helpers/forum-composer-stub").composerStub()
);
jest.mock("~/components/thinkpages-forum/ForumComposer", () => ({
  ForumComposer: ({ submitLabel = "Post", initialHtml, onSubmit }: ComposerStubProps) => (
    <div data-testid="composer" data-initial={initialHtml ?? ""}>
      <button
        type="button"
        onClick={() => void onSubmit({ html: "<p>new</p>", personaId: null, title: "Hello" })}
      >
        {submitLabel}
      </button>
    </div>
  ),
}));

// Radix DropdownMenu opens on pointer events jsdom does not model; render its items inline.
jest.mock("~/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect?: (event: Event) => void;
  }) => (
    <button type="button" role="menuitem" onClick={() => onSelect?.(new Event("select"))}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuRadioGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuRadioItem: ({ children }: { children: React.ReactNode }) => (
    <button type="button" role="menuitemradio">
      {children}
    </button>
  ),
}));

jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: null }) }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));

import { STUB_WIKITEXT } from "~/tests/helpers/forum-composer-stub";
import { AuthorName } from "~/components/thinkpages-forum/AuthorName";
import { BoardPage } from "~/components/thinkpages-forum/board";
import { ThreadPage } from "~/components/thinkpages-forum/thread";
import { NewThreadForm } from "~/components/thinkpages-forum/NewThreadForm";
import ForumHomePage from "~/app/thinkpages/page";

const { results, inputs, mutations } = jest.requireMock<MockApi>("~/trpc/react");
const { router, redirect } = jest.requireMock<{
  router: { push: jest.Mock; replace: jest.Mock };
  redirect: jest.Mock;
}>("next/navigation");

const authors = {
  users: {
    u1: { name: "Kir", handle: "kir", avatarUrl: null, flagUrl: null },
    u2: { name: "Hidden Player", handle: null, avatarUrl: null, flagUrl: null },
  },
  personas: { pa: { displayName: "Aria Vance", username: "aria", avatarUrl: null } },
};

const EURTH = { slug: "eurth", name: "Eurth" };
const HUB = { key: "hub", name: "Hub", description: "Realm talk", icAllowed: false, realm: EURTH };

function thread() {
  return {
    id: "t1",
    title: "A thread",
    authorUserId: "u1",
    authorPersonaId: null,
    pinned: false,
    locked: false,
    postCount: 2,
    lastPostAt: new Date(),
  };
}

function threadData(
  overrides: { locked?: boolean; canReply?: boolean; realm?: typeof EURTH } = {}
) {
  return {
    thread: {
      id: "t1",
      title: "<b>Plain</b> title",
      locked: overrides.locked ?? false,
      archived: false,
      postCount: 2,
      lastPostAt: new Date(),
      createdAt: new Date(),
    },
    style: "ooc",
    participants: [],
    participantCount: 0,
    category: overrides.realm
      ? { key: "hub", name: "Hub", icAllowed: false, realm: overrides.realm }
      : { key: "general", name: "General", icAllowed: false, realm: null },
    posts: [
      {
        id: "p1",
        authorUserId: "u1",
        authorPersonaId: null,
        contentHtml: "<p>First post</p>",
        editedAt: null,
        createdAt: new Date(),
        number: 1,
        role: null,
        isOwn: true,
      },
      {
        id: "p2",
        authorUserId: "u2",
        authorPersonaId: "pa",
        contentHtml: "<p>In character</p>",
        editedAt: null,
        createdAt: new Date(),
        number: 2,
        role: null,
        isOwn: false,
      },
    ],
    total: 2,
    canReply: overrides.canReply ?? true,
    authors,
  };
}

function categoryData(
  canStart: boolean,
  threads: object[] = [],
  category: object = { key: "general", name: "General", description: "Talk", icAllowed: false },
  notice: string | null = null
) {
  return { category, threads, total: threads.length, canStart, notice, authors };
}

/** Text matches to skip: the header's compact title is hidden from assistive tech until the header collapses. */
const HIDDEN = '[aria-hidden="true"]';

/** The breadcrumb trail's labels and hrefs: the pages above this one, each a link. */
/** The header's back link: the one link named `name` outside the breadcrumb trail. */
function backLink(name: string) {
  const trail = screen.getByRole("navigation", { name: "breadcrumb" });
  const outside = screen.getAllByRole("link", { name }).filter((link) => !trail.contains(link));
  expect(outside).toHaveLength(1);
  return outside[0]!;
}

function crumbs() {
  const trail = screen.getByRole("navigation", { name: "breadcrumb" });
  return within(trail)
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);
}

function set(name: string, result: QueryResult) {
  results[name] = result;
}

// A board's rail sits in the Inspector, which asks the viewport: narrow, so its panels stay out of these tests.
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(results)) delete results[key];
});

describe("forum home", () => {
  it("renders the forum home without a realm", async () => {
    set("categories", { data: [] });
    render(await ForumHomePage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { level: 1, name: "ThinkPages" })).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("opens an old ?realm= link on that realm's Hub", async () => {
    await ForumHomePage({ searchParams: Promise.resolve({ realm: "eurth" }) });
    expect(redirect).toHaveBeenCalledWith("/thinkpages/r/eurth/hub");
  });

  it("treats an empty ?realm= as none", async () => {
    set("categories", { data: [] });
    render(await ForumHomePage({ searchParams: Promise.resolve({ realm: "" }) }));
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("category view", () => {
  it("shows New thread only when canStart", () => {
    set("category", { data: categoryData(false) });
    const { rerender } = render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.queryByRole("link", { name: /New thread/ })).toBeNull();
    expect(screen.getByText("No threads yet")).toBeInTheDocument();
    expect(screen.getByText("Be the first to post")).toBeInTheDocument();

    set("category", { data: categoryData(true) });
    rerender(<BoardPage categoryKey="general" page={1} sort="latest" />);
    // In the header, and in the empty board.
    const links = screen.getAllByRole("link", { name: /New thread/ });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute("href", "/thinkpages/c/general/new");
  });

  it("explains why New thread is missing with the category's notice", () => {
    const notice = "Your nation is muted on this board until Jan 1.";
    set("category", { data: categoryData(false, [], undefined, notice) });
    const { rerender } = render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.getByText(notice)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /New thread/ })).toBeNull();

    set("category", { data: categoryData(true, [], undefined, notice) });
    rerender(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.queryByText(notice)).toBeNull();

    set("category", { data: categoryData(false) });
    rerender(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.queryByText(notice)).toBeNull();
  });

  it("lists threads with plain text titles and the persona, not the player", () => {
    set("category", {
      data: categoryData(false, [
        {
          id: "t1",
          title: "<i>Hi</i>",
          authorUserId: "u2",
          authorPersonaId: "pa",
          pinned: true,
          locked: false,
          postCount: 3,
          lastPostAt: new Date(),
        },
      ]),
    });
    render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.getByText("<i>Hi</i>")).toBeInTheDocument();
    expect(screen.getByText("Aria Vance")).toBeInTheDocument();
    expect(screen.queryByText("Hidden Player")).toBeNull();
    expect(
      within(screen.getByRole("row", { name: /<i>Hi<\/i>/ })).getByText("2")
    ).toBeInTheDocument();
  });

  it("has no trail on a sitewide category, whose only step up is the back link to ThinkPages (U5)", () => {
    set("category", { data: categoryData(false) });
    render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.queryByRole("navigation", { name: "breadcrumb" })).toBeNull();
    // The header keeps a back link to the forum home, which is all a top-level board has above it.
    expect(screen.getByRole("link", { name: "ThinkPages" })).toHaveAttribute("href", "/thinkpages");
    expect(screen.getAllByText("General", { ignore: HIDDEN })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "General" })).toBeInTheDocument();
  });

  it("scopes a realm category to its realm: query, New thread and breadcrumbs", () => {
    set("category", { data: categoryData(true, [thread()], HUB) });
    render(<BoardPage categoryKey="hub" realm="eurth" page={1} sort="latest" />);
    expect(inputs.category).toEqual({ key: "hub", page: 1, realm: "eurth", sort: "latest" });
    expect(screen.getByRole("link", { name: /New thread/ })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth/hub/new"
    );
    expect(crumbs()).toEqual([
      ["ThinkPages", "/thinkpages"],
      ["Eurth", "/thinkpages/r/eurth/hub"],
    ]);
    // The Hub is the top of its realm: back goes to the forum home, not to itself.
    expect(backLink("ThinkPages")).toHaveAttribute("href", "/thinkpages");
  });

  it("sends a realm's other boards back to its Hub", () => {
    const events = { ...HUB, key: "current-events", name: "Current Events" };
    set("category", { data: categoryData(false, [thread()], events) });
    render(<BoardPage categoryKey="current-events" realm="eurth" page={1} sort="latest" />);
    expect(backLink("Eurth")).toHaveAttribute("href", "/thinkpages/r/eurth/hub");
  });
});

describe("thread view", () => {
  it("renders posts with anchors, authors and the reply composer", () => {
    set("thread", { data: threadData() });
    const { container } = render(<ThreadPage threadId="t1" page={1} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "<b>Plain</b> title" })
    ).toBeInTheDocument();
    expect(container.querySelector("#post-p1")).toHaveTextContent("First post");
    expect(container.querySelector("#post-p2")).toHaveTextContent("In character");
    expect(screen.getByText("Kir")).toBeInTheDocument();
    expect(screen.getByText("Aria Vance")).toBeInTheDocument();
    expect(screen.getByText(/@aria/)).toBeInTheDocument();
    expect(screen.queryByText("Hidden Player")).toBeNull();
    expect(
      within(screen.getByTestId("composer")).getByRole("button", { name: "Reply" })
    ).toBeInTheDocument();
    expect(screen.queryByText("This thread is locked.")).toBeNull();
  });

  it("breadcrumbs a sitewide thread without a realm crumb, naming the thread and category once (U5)", () => {
    set("thread", { data: threadData() });
    render(<ThreadPage threadId="t1" page={1} />);
    expect(crumbs()).toEqual([
      ["ThinkPages", "/thinkpages"],
      ["General", "/thinkpages/c/general"],
    ]);
    expect(screen.getAllByText("<b>Plain</b> title", { ignore: HIDDEN })).toHaveLength(1);
    expect(backLink("General")).toHaveAttribute("href", "/thinkpages/c/general");
  });

  it("breadcrumbs a realm thread through its realm and category", () => {
    set("thread", { data: threadData({ realm: EURTH }) });
    render(<ThreadPage threadId="t1" page={1} />);
    expect(crumbs()).toEqual([
      ["ThinkPages", "/thinkpages"],
      ["Eurth", "/thinkpages/r/eurth/hub"],
      ["Hub", "/thinkpages/r/eurth/hub"],
    ]);
    expect(backLink("Hub")).toHaveAttribute("href", "/thinkpages/r/eurth/hub");
  });

  it("hides the reply composer and edit when locked", () => {
    set("thread", {
      data: threadData({ locked: true, canReply: false }),
    });
    render(<ThreadPage threadId="t1" page={1} />);
    expect(screen.getByText("This thread is locked.")).toBeInTheDocument();
    expect(screen.queryByTestId("composer")).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Edit" })).toBeNull();
  });

  it("edits only the viewer's own post, prefilled, and saves through editPost with the loaded editedAt", async () => {
    const data = threadData();
    const loaded = new Date("2026-10-01T10:00:00Z");
    set("thread", {
      data: { ...data, posts: [{ ...data.posts[0]!, editedAt: loaded }, data.posts[1]!] },
    });
    const editPost = jest.fn(() => Promise.resolve({}));
    mutations.editPost = editPost;
    render(<ThreadPage threadId="t1" page={1} />);
    const edits = screen.getAllByRole("menuitem", { name: "Edit" });
    expect(edits).toHaveLength(1);
    fireEvent.click(edits[0]!);
    const editor = screen.getAllByTestId("composer")[0]!;
    expect(editor).toHaveAttribute("data-initial", "<p>First post</p>");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(editPost).toHaveBeenCalledWith({ postId: "p1", html: "<p>new</p>", editedAt: loaded })
    );
  });

  it("edits a Canvas post in Canvas from its wikitext and saves wikitext, never html", async () => {
    const data = threadData();
    const loaded = new Date("2026-10-01T10:00:00Z");
    set("thread", {
      data: {
        ...data,
        posts: [
          { ...data.posts[0]!, editedAt: loaded, contentWikitext: "First '''post'''" },
          data.posts[1]!,
        ],
      },
    });
    const editPost = jest.fn(() => Promise.resolve({ formatting: "done" }));
    mutations.editPost = editPost;
    render(<ThreadPage threadId="t1" page={1} />);
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(screen.getByTestId("canvas-composer")).toHaveAttribute(
      "data-initial",
      "First '''post'''"
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(editPost).toHaveBeenCalledWith({
        postId: "p1",
        wikitext: STUB_WIKITEXT,
        editedAt: loaded,
      })
    );
    // Saved and formatted: the editor closes.
    await waitFor(() => expect(screen.queryByTestId("canvas-composer")).toBeNull());
  });

  it("keeps the Canvas editor open when the wiki is still formatting the edit", async () => {
    const data = threadData();
    set("thread", {
      data: { ...data, posts: [{ ...data.posts[0]!, contentWikitext: "x" }, data.posts[1]!] },
    });
    const editPost = jest.fn(() => Promise.resolve({ formatting: "pending" }));
    mutations.editPost = editPost;
    render(<ThreadPage threadId="t1" page={1} />);
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(editPost).toHaveBeenCalled());
    expect(screen.getByTestId("canvas-composer")).toBeInTheDocument();
  });

  it("after a reply goes to the reply's page and anchor", async () => {
    set("thread", { data: threadData() });
    const reply = jest.fn(() => Promise.resolve({ postId: "p9", formatting: "done" }));
    mutations.reply = reply;
    render(<ThreadPage threadId="t1" page={1} />);
    fireEvent.click(within(screen.getByTestId("composer")).getByRole("button", { name: "Reply" }));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/thinkpages/t/t1?page=3#post-p9")
    );
    expect(reply).toHaveBeenCalledWith({
      threadId: "t1",
      wikitext: STUB_WIKITEXT,
      personaId: null,
    });
  });
});

describe("load failures and out-of-range pages", () => {
  it("says Category not found only for NOT_FOUND", () => {
    set("category", { data: undefined, error: { data: { code: "NOT_FOUND" } } });
    render(<BoardPage categoryKey="secret" page={1} sort="latest" />);
    expect(screen.getByText("Category not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the forum" })).toHaveAttribute(
      "href",
      "/thinkpages"
    );
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("offers Retry for any other category error", () => {
    const refetch = jest.fn();
    set("category", {
      data: undefined,
      error: { data: { code: "INTERNAL_SERVER_ERROR" } },
      refetch,
    });
    render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.queryByText("Category not found")).toBeNull();
    expect(screen.getByText("Could not load this page")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("says Thread not found only for NOT_FOUND, and Retry otherwise", () => {
    set("thread", { data: undefined, error: { data: { code: "NOT_FOUND" } } });
    const { unmount } = render(<ThreadPage threadId="gone" page={1} />);
    expect(screen.getByText("Thread not found")).toBeInTheDocument();
    unmount();

    const refetch = jest.fn();
    set("thread", { data: undefined, error: { data: { code: "TIMEOUT" } }, refetch });
    render(<ThreadPage threadId="t1" page={1} />);
    expect(screen.queryByText("Thread not found")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("sends a category page past the end to the last page", () => {
    set("category", { data: { ...categoryData(false), total: 30 } });
    render(<BoardPage categoryKey="general" page={5} sort="latest" />);
    expect(router.replace).toHaveBeenCalledWith("/thinkpages/c/general?page=2");
    expect(screen.queryByText("No threads yet")).toBeNull();
  });

  it("sends a thread page past the end to the last page", () => {
    set("thread", { data: { ...threadData(), posts: [] } });
    render(<ThreadPage threadId="t1" page={4} />);
    expect(router.replace).toHaveBeenCalledWith("/thinkpages/t/t1?page=1");
    expect(screen.queryByTestId("composer")).toBeNull();
  });

  it("keeps an empty category on its page without redirecting", () => {
    set("category", { data: categoryData(false) });
    render(<BoardPage categoryKey="general" page={3} sort="latest" />);
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByText("No threads yet")).toBeInTheDocument();
  });
});

describe("new thread", () => {
  it("creates the thread and opens it", async () => {
    set("category", { data: categoryData(true) });
    const create = jest.fn(() =>
      Promise.resolve({ threadId: "t7", postId: "p7", formatting: "done" })
    );
    mutations.createThread = create;
    render(<NewThreadForm categoryKey="general" />);
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/thinkpages/t/t7"));
    expect(create).toHaveBeenCalledWith({
      categoryKey: "general",
      title: "Hello",
      wikitext: STUB_WIKITEXT,
      personaId: null,
    });
  });

  it("starts a realm thread in that realm", async () => {
    set("category", { data: categoryData(true, [], HUB) });
    const create = jest.fn(() =>
      Promise.resolve({ threadId: "t8", postId: "p8", formatting: "done" })
    );
    mutations.createThread = create;
    render(<NewThreadForm categoryKey="hub" realm="eurth" />);
    expect(inputs.category).toEqual({ key: "hub", page: 1, realm: "eurth" });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/thinkpages/t/t8"));
    expect(create).toHaveBeenCalledWith({
      categoryKey: "hub",
      realm: "eurth",
      title: "Hello",
      wikitext: STUB_WIKITEXT,
      personaId: null,
    });
  });

  it("stays on the page while the first post is still being formatted, with a way in", async () => {
    set("category", { data: categoryData(true) });
    mutations.createThread = jest.fn(() =>
      Promise.resolve({ threadId: "t9", postId: "p9", formatting: "pending" })
    );
    router.push.mockClear();
    render(<NewThreadForm categoryKey="general" />);
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(await screen.findByRole("link", { name: "Open the thread" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t9"
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it("explains a refusal with the category's notice, else the general copy", () => {
    const notice = "Only owners of a nation in Eurth can post here.";
    set("category", { data: categoryData(false, [], HUB, notice) });
    const { unmount } = render(<NewThreadForm categoryKey="hub" realm="eurth" />);
    expect(screen.getByText(notice)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the forum" })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth/hub"
    );
    unmount();

    set("category", { data: categoryData(false) });
    render(<NewThreadForm categoryKey="general" />);
    expect(screen.getByText("Sign in, or pick a category open to members.")).toBeInTheDocument();
  });
});

describe("imported authors (phase 4)", () => {
  const imported = { authorUserId: null, authorPersonaId: null, importedAuthorName: "OldName" };

  it("names a user, else the imported name, else Member", () => {
    const { rerender } = render(
      <AuthorName authors={authors} userId={null} personaId={null} importedName="OldName" />
    );
    expect(screen.getByText("OldName")).toBeInTheDocument();
    rerender(<AuthorName authors={authors} userId={null} personaId={null} />);
    expect(screen.getByText("Member")).toBeInTheDocument();
    rerender(<AuthorName authors={authors} userId="u1" personaId={null} importedName="OldName" />);
    expect(screen.getByText("Kir")).toBeInTheDocument();
    expect(screen.queryByText("OldName")).toBeNull();
  });

  it("never shows the imported name or the player for a persona post, even when the persona is gone", () => {
    const { rerender } = render(
      <AuthorName authors={authors} userId="u2" personaId="pa" importedName="OldName" />
    );
    expect(screen.getByText("Aria Vance")).toBeInTheDocument();
    expect(screen.queryByText("OldName")).toBeNull();
    rerender(<AuthorName authors={authors} userId="u2" personaId="gone" importedName="OldName" />);
    expect(screen.getByText("Member")).toBeInTheDocument();
    expect(screen.queryByText("OldName")).toBeNull();
    expect(screen.queryByText("Hidden Player")).toBeNull();
  });

  it("shows an imported thread's author in the category list", () => {
    set("category", {
      data: categoryData(false, [
        {
          id: "t9",
          title: "From the old forum",
          ...imported,
          pinned: false,
          locked: false,
          postCount: 1,
          lastPostAt: new Date(),
        },
      ]),
    });
    render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.getByText("OldName")).toBeInTheDocument();
  });

  it("shows an imported post's author in the thread", () => {
    const data = threadData();
    set("thread", {
      data: { ...data, posts: [{ ...data.posts[0]!, ...imported, isOwn: false }] },
    });
    const { container } = render(<ThreadPage threadId="t1" page={1} />);
    expect(container.querySelector("#post-p1")).toHaveTextContent("OldName");
    expect(screen.queryByText("Kir")).toBeNull();
  });
});

describe("imported threads and the old-forum archive (phase 4)", () => {
  const row = {
    authorUserId: "u1",
    authorPersonaId: null,
    importedAuthorName: null,
    pinned: false,
    locked: false,
    postCount: 3,
    lastPostAt: new Date(),
  };

  it("says an imported thread came from the old forum, and says nothing otherwise", () => {
    const data = threadData();
    set("thread", { data: { ...data, thread: { ...data.thread, xenforoThreadId: 4821 } } });
    const { unmount } = render(<ThreadPage threadId="t1" page={1} />);
    expect(screen.getByText("Imported from the old forum.")).toBeInTheDocument();
    unmount();

    set("thread", { data: { ...data, thread: { ...data.thread, xenforoThreadId: null } } });
    render(<ThreadPage threadId="t1" page={1} />);
    expect(screen.queryByText(/Imported from the old forum/)).toBeNull();
  });

  it("marks imported threads in the thread list, and only those", () => {
    set("category", {
      data: categoryData(false, [
        { id: "t1", title: "Old thread", ...row, xenforoThreadId: 7 },
        { id: "t2", title: "New thread", ...row, xenforoThreadId: null },
      ]),
    });
    render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    const old = screen.getByRole("row", { name: /Old thread/ });
    const fresh = screen.getByRole("row", { name: /New thread/ });
    expect(within(old).getByText("Imported")).toBeInTheDocument();
    expect(within(fresh).queryByText("Imported")).toBeNull();
  });
});

describe("new thread when the viewer cannot start one (phase 4, R8)", () => {
  it("frames the ban notice with the page header and a way back, like the form", () => {
    const notice = "You are banned from the forum until 12 Oct 2026: spam";
    set("category", {
      data: { ...categoryData(false, [], HUB, notice), banned: true },
    });
    render(<NewThreadForm categoryKey="hub" realm="eurth" />);
    expect(screen.getByRole("heading", { level: 1, name: "New thread" })).toBeInTheDocument();
    expect(screen.getByText(notice)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Appeal" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Hub/ })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth/hub"
    );
    expect(screen.getByRole("link", { name: "Back to the forum" })).toBeInTheDocument();
  });

  it("frames the plain refusal the same way", () => {
    set("category", { data: categoryData(false) });
    render(<NewThreadForm categoryKey="general" />);
    expect(screen.getByRole("heading", { level: 1, name: "New thread" })).toBeInTheDocument();
    expect(screen.getByText("You can't start a thread here")).toBeInTheDocument();
  });
});
