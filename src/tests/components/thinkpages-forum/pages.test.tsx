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
        getThinktanks: query("thinktanks"),
      },
      useUtils: () => ({
        thinkpagesForum: {
          thread: { invalidate: () => Promise.resolve() },
          category: { invalidate: () => Promise.resolve() },
          categories: { invalidate: () => Promise.resolve() },
          realmSection: { invalidate: () => Promise.resolve() },
          myStanding: { invalidate: () => Promise.resolve() },
          navCounts: { invalidate: () => Promise.resolve() },
          resolvePost: { fetch: () => Promise.resolve({ threadId: "t1", page: 3 }) },
        },
        thinkpagesForumMod: { context: { invalidate: () => Promise.resolve() } },
      }),
      thinkpagesForum: {
        categories: query("categories"),
        realms: query("realms"),
        latestActivity: query("latestActivity"),
        trending: query("trending"),
        navFlags: query("navFlags"),
        navCounts: query("navCounts"),
        realmSection: query("realmSection"),
        category: query("category"),
        thread: query("thread"),
        reply: mutation("reply"),
        markThreadRead: mutation("markThreadRead"),
        markCategoryRead: mutation("markCategoryRead"),
        watchThread: mutation("watchThread"),
        unwatchThread: mutation("unwatchThread"),
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

jest.mock("~/components/thinkpages-forum/reactions", () => ({ ReactionBar: () => null }));
jest.mock("~/components/action-links/DiscussionCountsProvider", () => ({
  DiscussionCountsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDiscussionCount: () => undefined,
}));
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
import { AuthorName, type ForumAuthors } from "~/components/thinkpages-forum/AuthorName";
import { BoardPage } from "~/components/thinkpages-forum/board";
import { ThreadPage } from "~/components/thinkpages-forum/thread";
import "~/app/thinkpages/page";

const { results, mutations } = jest.requireMock<MockApi>("~/trpc/react");

const authors: ForumAuthors = {
  users: {
    u1: { name: "Kir", handle: "kir", avatarUrl: null, flagUrl: null },
    u2: { name: "Hidden Player", handle: null, avatarUrl: null, flagUrl: null },
  },
  personas: {
    pa: { displayName: "Aria Vance", username: "aria", avatarUrl: null, personaType: "citizen" },
  },
};

const EURTH = { slug: "eurth", name: "Eurth" };

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
        reactions: {},
        myReaction: null,
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
        reactions: {},
        myReaction: null,
      },
    ],
    total: 2,
    canReply: overrides.canReply ?? true,
    canReact: true,
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
  mutations.markThreadRead = jest.fn().mockResolvedValue({});
  mutations.markCategoryRead = jest.fn().mockResolvedValue({});
});
describe("category view", () => {
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
});

describe("thread view", () => {
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
});
describe("imported authors (phase 4)", () => {
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
});
