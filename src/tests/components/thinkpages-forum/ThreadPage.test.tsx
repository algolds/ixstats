import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

interface QueryResult {
  data?: object | null;
  isLoading?: boolean;
  error?: { data?: { code: string } } | null;
}

interface MockApi {
  results: Record<string, QueryResult>;
  mutations: Record<string, jest.Mock>;
}

jest.mock("~/trpc/react", () => {
  const results: Record<string, QueryResult> = {};
  const mutations: Record<string, jest.Mock> = {};
  const query = (name: string) => ({
    useQuery: () => ({ isLoading: false, error: null, ...results[name] }),
  });
  const mutation = (name: string) => ({
    useMutation: () => ({ mutateAsync: mutations[name], mutate: jest.fn(), isPending: false }),
  });
  const invalidate = () => Promise.resolve();
  return {
    results,
    mutations,
    api: {
      useUtils: () => ({
        thinkpagesForum: {
          thread: { invalidate },
          category: { invalidate },
          categories: { invalidate },
          realmSection: { invalidate },
          isThreadStashed: { invalidate },
          resolvePost: { fetch: () => Promise.resolve({ threadId: "t1", page: 1 }) },
        },
        thinkpagesForumMod: { invalidate, context: { invalidate } },
      }),
      thinkpagesForum: {
        thread: query("thread"),
        isThreadStashed: query("isThreadStashed"),
        stashThread: mutation("stashThread"),
        unstashThread: mutation("unstashThread"),
        reply: mutation("reply"),
        editPost: mutation("editPost"),
        report: mutation("report"),
      },
      thinkpagesForumMod: {
        context: query("context"),
        setThreadFlag: mutation("setThreadFlag"),
        moveThread: mutation("moveThread"),
        setPostHidden: mutation("setPostHidden"),
        editPost: mutation("modEditPost"),
      },
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
    usePathname: () => "/thinkpages/t/t1",
    useSearchParams: () => new URLSearchParams(),
  };
});
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));
jest.mock("~/context/auth-context", () => {
  const auth = { isSignedIn: true };
  return { auth, useUser: () => ({ user: null, isSignedIn: auth.isSignedIn }) };
});
jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
  return { notify, useNotify: () => notify };
});
jest.mock("~/components/thinkpages-forum/composer", () =>
  jest.requireActual("~/tests/helpers/forum-composer-stub").composerStub()
);
jest.mock("~/components/thinkpages-forum/ForumComposer", () => ({
  ForumComposer: ({ submitLabel = "Post" }: { submitLabel?: string }) => (
    <div data-testid="composer" contentEditable suppressContentEditableWarning>
      {submitLabel}
    </div>
  ),
}));
jest.mock("~/components/wiki-os/reader/WikiLinkPreview", () => ({
  WikiHtmlContent: ({ html, className }: { html: string; className?: string }) => (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  ),
}));
jest.mock("~/components/thinkpages-forum/thread/WikiEmbed", () => ({ WikiEmbeds: () => null }));
jest.mock("~/components/thinkpages/PersonaAuthorCard", () => ({
  PersonaAuthorCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
}));

import { ThreadPage } from "~/components/thinkpages-forum/thread";

const { results } = jest.requireMock<MockApi>("~/trpc/react");
const { auth } = jest.requireMock<{ auth: { isSignedIn: boolean } }>("~/context/auth-context");
const { notify } = jest.requireMock<{ notify: { success: jest.Mock; error: jest.Mock } }>(
  "~/hooks/useNotify"
);

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

const authors = {
  users: {
    u1: { name: "Fiannria", handle: "fiannria", avatarUrl: null, flagUrl: "/flags/fi.png" },
    u2: { name: "Urcea", handle: "urcea", avatarUrl: null, flagUrl: "/flags/ur.png" },
  },
  personas: { pa: { displayName: "Aria Vance", username: "aria", avatarUrl: null } },
};

function post(over: object = {}) {
  return {
    id: "p1",
    authorUserId: "u1",
    authorPersonaId: null,
    importedAuthorName: null,
    contentHtml: "<p>First post</p>",
    editedAt: null,
    createdAt: new Date("2026-03-12T18:40:00Z"),
    number: 1,
    role: "starter" as "staff" | "officer" | "starter" | null,
    byViewer: false,
    isOwn: false,
    ...over,
  };
}

interface Overrides {
  style?: "ic" | "ooc";
  locked?: boolean;
  canReply?: boolean;
  notice?: string | null;
  posts?: object[];
  total?: number;
  participants?: object[];
  participantCount?: number;
  realm?: { slug: string; name: string } | null;
}

function threadData(o: Overrides = {}) {
  const posts = o.posts ?? [
    post({ isOwn: true, byViewer: true }),
    post({ id: "p2", authorUserId: "u2", number: 2, role: "staff", contentHtml: "<p>Reply</p>" }),
  ];
  return {
    thread: {
      id: "t1",
      title: "River compacts",
      authorUserId: "u1",
      authorPersonaId: null,
      xenforoThreadId: null,
      locked: o.locked ?? false,
      pinned: false,
      hidden: false,
      archived: false,
      postCount: o.total ?? posts.length,
      lastPostAt: new Date("2026-03-14T09:00:00Z"),
      createdAt: new Date("2026-03-12T18:40:00Z"),
    },
    category: {
      id: "c1",
      key: "hub",
      name: "Hub",
      icAllowed: true,
      realm: o.realm === undefined ? { slug: "ixworld", name: "IxWorld" } : o.realm,
    },
    style: o.style ?? "ooc",
    posts,
    total: o.total ?? posts.length,
    participants: o.participants ?? [],
    participantCount: o.participantCount ?? 0,
    canReply: o.canReply ?? true,
    canModerate: false,
    viewerIsAuthor: false,
    notice: o.notice ?? null,
    banned: false,
    authors,
  };
}

function set(data: object | undefined) {
  results.thread = { data };
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(results)) delete results[key];
  auth.isSignedIn = true;
  installViewport(false);
  results.isThreadStashed = { data: { stashed: false } };
  results.context = { data: { isSiteAdmin: false, realms: [], categories: [] } };
});

describe("the thread page", () => {
  it("shows every post in one feed pane, divided, with no card per post", () => {
    set(threadData());
    const { container } = render(<ThreadPage threadId="t1" page={1} />);
    const feeds = container.querySelectorAll('[data-content="feed"]');
    expect(feeds).toHaveLength(1);
    const first = container.querySelector("#post-p1")!;
    const second = container.querySelector("#post-p2")!;
    expect(feeds[0]).toContainElement(first as HTMLElement);
    expect(feeds[0]).toContainElement(second as HTMLElement);
    expect(feeds[0]?.querySelectorAll('[data-slot="card"]')).toHaveLength(0);
    expect(first).not.toHaveClass("border-t");
    expect(second).toHaveClass("border-t", "border-separator");
  });

  it("gives each post its header: author, flag, the server's role pill and its #N permalink", () => {
    set(threadData());
    const { container } = render(<ThreadPage threadId="t1" page={1} />);
    const first = within(container.querySelector<HTMLElement>("#post-p1")!);
    expect(first.getByText("Fiannria")).toBeInTheDocument();
    expect(first.getByText("Thread starter")).toBeInTheDocument();
    expect(first.getByRole("link", { name: /#1/ })).toHaveAttribute("href", "/thinkpages/post/p1");
    expect(container.querySelector("#post-p1 img[src='/flags/fi.png']")).not.toBeNull();
    const second = within(container.querySelector<HTMLElement>("#post-p2")!);
    expect(second.getByText("Staff")).toBeInTheDocument();
    expect(second.queryByText("Thread starter")).toBeNull();
  });

  it("styles an in-character thread as an article and says so; an out-of-character one is compact", () => {
    set(threadData({ style: "ic" }));
    const { container, unmount } = render(<ThreadPage threadId="t1" page={1} />);
    expect(screen.getByText("In character")).toBeInTheDocument();
    expect(container.querySelectorAll(".forum-post--ic")).toHaveLength(2);
    unmount();

    set(threadData({ style: "ooc" }));
    const ooc = render(<ThreadPage threadId="t1" page={1} />);
    expect(screen.queryByText("In character")).toBeNull();
    expect(ooc.container.querySelectorAll(".forum-post--ooc")).toHaveLength(2);
    expect(ooc.container.querySelector(".forum-post--ic")).toBeNull();
  });

  it("shows a persona post as the persona only: no player, no flag, no role", () => {
    set(
      threadData({
        posts: [
          post({
            id: "p3",
            authorUserId: null,
            authorPersonaId: "pa",
            role: null,
            number: 1,
          }),
        ],
      })
    );
    const { container } = render(<ThreadPage threadId="t1" page={1} />);
    const card = container.querySelector<HTMLElement>("#post-p3")!;
    expect(within(card).getByText("Aria Vance")).toBeInTheDocument();
    expect(within(card).getByText(/@aria/)).toBeInTheDocument();
    expect(within(card).queryByText("Fiannria")).toBeNull();
    expect(card.querySelector("img[width='18']")).toBeNull();
    expect(within(card).queryByText(/Staff|Officer|Thread starter/)).toBeNull();
  });

  it("marks an imported post without an account as from the old forum", () => {
    set(
      threadData({
        posts: [post({ authorUserId: null, importedAuthorName: "Kir", role: null })],
      })
    );
    render(<ThreadPage threadId="t1" page={1} />);
    expect(screen.getByText("Kir")).toBeInTheDocument();
    expect(screen.getByText("Old forum")).toBeInTheDocument();
  });

  it("renders a quote block inside a post body", () => {
    set(
      threadData({
        posts: [
          post({
            contentHtml:
              '<blockquote class="forum-quote" data-post="p0"><div class="forum-quote-author">Ann wrote:</div><div class="forum-quote-body">hello</div></blockquote><p>answer</p>',
          }),
        ],
      })
    );
    const { container } = render(<ThreadPage threadId="t1" page={1} />);
    expect(container.querySelector("#post-p1 blockquote.forum-quote")).toHaveTextContent("hello");
  });

  it("summarises the page in the pane footer and paginates", () => {
    set(
      threadData({
        total: 87,
        posts: [post({ number: 21 }), post({ id: "p2", number: 22, authorUserId: "u2" })],
      })
    );
    const { container } = render(<ThreadPage threadId="t1" page={2} />);
    const feed = container.querySelector('[data-content="feed"]')!;
    expect(within(feed as HTMLElement).getByText("Posts 21–22 of 87")).toBeInTheDocument();
    expect(within(feed as HTMLElement).getAllByRole("navigation", { name: "Pagination" })).toHaveLength(1);
  });

  it("goes back to the thread's board", () => {
    set(threadData());
    render(<ThreadPage threadId="t1" page={1} />);
    const trail = screen.getByRole("navigation", { name: "breadcrumb" });
    const back = screen
      .getAllByRole("link", { name: "Hub" })
      .filter((link) => !trail.contains(link));
    expect(back).toHaveLength(1);
    expect(back[0]).toHaveAttribute("href", "/thinkpages/r/ixworld/hub");
  });
});

describe("the reply area", () => {
  it("offers the composer when the viewer may reply", () => {
    set(threadData());
    render(<ThreadPage threadId="t1" page={1} />);
    expect(screen.getByTestId("composer")).toBeInTheDocument();
  });

  it("replaces the composer with a lock note on a locked thread", () => {
    set(threadData({ locked: true, canReply: false }));
    render(<ThreadPage threadId="t1" page={1} />);
    expect(screen.getByText("This thread is locked.")).toBeInTheDocument();
    expect(screen.queryByTestId("composer")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();
  });

  it("gives the server's notice when the viewer may not post", () => {
    set(threadData({ canReply: false, notice: "Only IxWorld members can post here." }));
    render(<ThreadPage threadId="t1" page={1} />);
    expect(screen.getByText("Only IxWorld members can post here.")).toBeInTheDocument();
    expect(screen.queryByTestId("composer")).toBeNull();
  });

  it("Reply on a post takes the reader to the composer", () => {
    set(threadData());
    const { container } = render(<ThreadPage threadId="t1" page={1} />);
    const scroll = jest.fn();
    Element.prototype.scrollIntoView = scroll;
    fireEvent.click(within(container.querySelector<HTMLElement>("#post-p2")!).getByRole("button", { name: "Reply" }));
    expect(scroll).toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByTestId("composer"));
  });

  it("Quote hands the composer the post's id, author and text", () => {
    set(threadData());
    const { container } = render(<ThreadPage threadId="t1" page={1} />);
    expect(screen.getByTestId("composer")).toHaveAttribute("data-quote", "");
    fireEvent.click(within(container.querySelector<HTMLElement>("#post-p2")!).getByRole("button", { name: "Quote" }));
    expect(screen.getByTestId("composer")).toHaveAttribute("data-quote", "p2");
  });

  describe("on a phone", () => {
    function installPhone() {
      window.matchMedia = ((query: string) => ({
        matches: query === "(max-width: 767px)",
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia;
    }

    it("docks a Reply bar instead of the composer, and Reply or Quote on a post opens it", () => {
      installPhone();
      set(threadData());
      const { container } = render(<ThreadPage threadId="t1" page={1} />);
      expect(screen.getByTestId("reply-dock")).toBeInTheDocument();
      expect(screen.queryByTestId("composer")).toBeNull();
      fireEvent.click(within(container.querySelector<HTMLElement>("#post-p2")!).getByRole("button", { name: "Quote" }));
      expect(screen.getByTestId("composer")).toHaveAttribute("data-quote", "p2");
    });

    it("opens the composer from the dock", () => {
      installPhone();
      set(threadData());
      render(<ThreadPage threadId="t1" page={1} />);
      fireEvent.click(screen.getByTestId("reply-dock"));
      expect(screen.getByTestId("composer")).toBeInTheDocument();
    });
  });
});

describe("post actions", () => {
  it("Share copies the post's absolute permalink and confirms", async () => {
    set(threadData());
    const writeText = jest.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    const { container } = render(<ThreadPage threadId="t1" page={1} />);
    fireEvent.click(within(container.querySelector<HTMLElement>("#post-p2")!).getByRole("button", { name: "Share" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/thinkpages/post/p2`)
    );
    expect(notify.success).toHaveBeenCalledWith("Link copied");
  });

  it("keeps Report, Edit and the rest in a More actions menu, Edit on the viewer's own post only", () => {
    set(threadData());
    const { container } = render(<ThreadPage threadId="t1" page={1} />);
    const own = within(container.querySelector<HTMLElement>("#post-p1")!);
    expect(own.getByRole("button", { name: "More actions" })).toBeInTheDocument();
    expect(own.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(own.queryByRole("menuitem", { name: "Report" })).toBeNull();
    const theirs = within(container.querySelector<HTMLElement>("#post-p2")!);
    expect(theirs.getByRole("menuitem", { name: "Report" })).toBeInTheDocument();
    expect(theirs.queryByRole("menuitem", { name: "Edit" })).toBeNull();
  });

  it("offers an anonymous visitor Share and the permalink only", () => {
    auth.isSignedIn = false;
    set(threadData({ canReply: false, notice: "Sign in to post." }));
    const { container } = render(<ThreadPage threadId="t1" page={1} />);
    const card = within(container.querySelector<HTMLElement>("#post-p2")!);
    expect(card.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(card.queryByRole("button", { name: "More actions" })).toBeNull();
    expect(card.queryByRole("button", { name: "Reply" })).toBeNull();
  });
});

describe("the rail", () => {
  it("summarises the thread, lists participants and the wiki pages the first post links to", () => {
    installViewport(true);
    set(
      threadData({
        total: 3,
        participantCount: 9,
        participants: [
          { authorUserId: "u1", authorPersonaId: null, importedAuthorName: null, posts: 2 },
          { authorUserId: null, authorPersonaId: "pa", importedAuthorName: null, posts: 1 },
        ],
        posts: [
          post({
            contentHtml:
              '<p><a href="/wiki/River_compacts">river</a> <a href="https://ixwiki.com/wiki/Juan_Kerr" class="forum-wikilink">Juan</a></p>',
          }),
        ],
      })
    );
    render(<ThreadPage threadId="t1" page={1} />);
    const thisThread = screen.getByRole("heading", { name: "This thread" }).closest("[data-slot=card]")!;
    expect(within(thisThread as HTMLElement).getByText("Replies")).toBeInTheDocument();
    expect(within(thisThread as HTMLElement).getByText("Open")).toBeInTheDocument();
    // The figure is the thread's true count, not the length of the short top list.
    expect(within(thisThread as HTMLElement).getByText("9")).toBeInTheDocument();
    const participants = screen.getByRole("heading", { name: "Participants" }).closest("[data-slot=card]")!;
    expect(within(participants as HTMLElement).getByText("2 posts")).toBeInTheDocument();
    expect(within(participants as HTMLElement).getByText("Aria Vance")).toBeInTheDocument();
    const related = screen.getByRole("heading", { name: "Related on the wiki" }).closest("[data-slot=card]")!;
    expect(within(related as HTMLElement).getByRole("link", { name: "River compacts" })).toHaveAttribute(
      "href",
      "/wiki/River_compacts"
    );
    expect(within(related as HTMLElement).getByRole("link", { name: "Juan Kerr" })).toBeInTheDocument();
  });

  it("hides the Participants and Related panels when they have nothing to show", () => {
    installViewport(true);
    set(threadData());
    render(<ThreadPage threadId="t1" page={1} />);
    expect(screen.getByRole("heading", { name: "This thread" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Participants" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Related on the wiki" })).toBeNull();
  });

  it("takes related pages from the thread's first post only", () => {
    installViewport(true);
    set(
      threadData({
        posts: [post({ number: 21, contentHtml: '<p><a href="/wiki/Elsewhere">x</a></p>' })],
      })
    );
    render(<ThreadPage threadId="t1" page={2} />);
    expect(screen.queryByRole("heading", { name: "Related on the wiki" })).toBeNull();
  });
});
