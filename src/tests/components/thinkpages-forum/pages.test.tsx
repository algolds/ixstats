import React, { Suspense } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

interface QueryResult {
  data?: object | null;
  isLoading?: boolean;
  error?: { data?: { code: string } } | null;
  refetch?: jest.Mock;
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
  return {
    results,
    mutations,
    api: {
      useUtils: () => ({
        thinkpagesForum: {
          thread: { invalidate: () => Promise.resolve() },
          category: { invalidate: () => Promise.resolve() },
          categories: { invalidate: () => Promise.resolve() },
          resolvePost: { fetch: () => Promise.resolve({ threadId: "t1", page: 3 }) },
        },
        thinkpages: { getPost: { invalidate: jest.fn() }, getFeed: { invalidate: jest.fn() } },
      }),
      thinkpagesForum: {
        categories: query("categories"),
        category: query("category"),
        thread: query("thread"),
        resolvePost: query("resolvePost"),
        reply: mutation("reply"),
        editPost: mutation("editPost"),
        createThread: mutation("createThread"),
      },
      actionLinks: { activityCards: query("activityCards") },
      users: { getProfile: query("getProfile") },
      thinkpages: {
        getAccountsByCountry: query("getAccountsByCountry"),
        getPost: query("getPost"),
        recordPostView: mutation("recordPostView"),
        createPost: mutation("createPost"),
      },
    },
  };
});

jest.mock("next/navigation", () => {
  const router = { push: jest.fn(), replace: jest.fn() };
  return { router, useRouter: () => router };
});

jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));

interface ComposerStubProps {
  submitLabel?: string;
  initialHtml?: string;
  onSubmit: (input: { html: string; personaId: string | null; title?: string }) => Promise<void>;
}

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

jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: null }) }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock("~/components/thinkpages/ThinkpagesPost", () => ({
  ThinkpagesPost: () => <div>feed post</div>,
}));

import { CategoryList } from "~/components/thinkpages-forum/CategoryList";
import { ThreadList } from "~/components/thinkpages-forum/ThreadList";
import { ThreadView } from "~/components/thinkpages-forum/ThreadView";
import { NewThreadForm } from "~/components/thinkpages-forum/NewThreadForm";
import PostPage from "~/app/thinkpages/post/[postId]/page";

const { results, mutations } = jest.requireMock<MockApi>("~/trpc/react");
const { router } = jest.requireMock<{ router: { push: jest.Mock; replace: jest.Mock } }>(
  "next/navigation"
);

const authors = {
  users: { u1: { name: "Kir", handle: "kir" }, u2: { name: "Hidden Player", handle: null } },
  personas: { pa: { displayName: "Aria Vance", username: "aria" } },
};

function threadData(overrides: { locked?: boolean; canReply?: boolean } = {}) {
  return {
    thread: {
      id: "t1",
      title: "<b>Plain</b> title",
      locked: overrides.locked ?? false,
      archived: false,
    },
    category: { key: "general", name: "General", icAllowed: false },
    posts: [
      {
        id: "p1",
        authorUserId: "u1",
        authorPersonaId: null,
        contentHtml: "<p>First post</p>",
        editedAt: null,
        createdAt: new Date(),
        isOwn: true,
      },
      {
        id: "p2",
        authorUserId: "u2",
        authorPersonaId: "pa",
        contentHtml: "<p>In character</p>",
        editedAt: null,
        createdAt: new Date(),
        isOwn: false,
      },
    ],
    total: 2,
    canReply: overrides.canReply ?? true,
    authors,
  };
}

function categoryData(canStart: boolean, threads: object[] = []) {
  return {
    category: { key: "general", name: "General", description: "Talk", icAllowed: false },
    threads,
    total: threads.length,
    canStart,
    authors,
  };
}

function set(name: string, result: QueryResult) {
  results[name] = result;
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(results)) delete results[key];
  set("activityCards", { data: [] });
});

describe("forum home", () => {
  it("lists the categories it is given, linking to each", () => {
    set("categories", {
      data: [
        { key: "general", name: "General", description: "Talk", threadCount: 2, lastPostAt: null },
        {
          key: "side-games",
          name: "Side Games",
          description: null,
          threadCount: 1,
          lastPostAt: null,
        },
      ],
    });
    render(<CategoryList />);
    expect(screen.getByRole("heading", { level: 1, name: "ThinkPages Forum" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /General/ })).toHaveAttribute(
      "href",
      "/thinkpages/c/general"
    );
    expect(screen.getByRole("link", { name: /Side Games/ })).toHaveAttribute(
      "href",
      "/thinkpages/c/side-games"
    );
    expect(screen.getByText("1 thread")).toBeInTheDocument();
  });
});

describe("category view", () => {
  it("shows New thread only when canStart", () => {
    set("category", { data: categoryData(false) });
    const { rerender } = render(<ThreadList categoryKey="general" page={1} />);
    expect(screen.queryByRole("link", { name: /New thread/ })).toBeNull();
    expect(screen.getByText("No threads yet")).toBeInTheDocument();
    expect(screen.getByText("Be the first to post")).toBeInTheDocument();

    set("category", { data: categoryData(true) });
    rerender(<ThreadList categoryKey="general" page={1} />);
    expect(screen.getByRole("link", { name: /New thread/ })).toHaveAttribute(
      "href",
      "/thinkpages/c/general/new"
    );
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
    render(<ThreadList categoryKey="general" page={1} />);
    expect(screen.getByText("<i>Hi</i>")).toBeInTheDocument();
    expect(screen.getByText("Aria Vance")).toBeInTheDocument();
    expect(screen.queryByText("Hidden Player")).toBeNull();
    expect(screen.getByText("2 replies")).toBeInTheDocument();
  });
});

describe("thread view", () => {
  it("renders posts with anchors, authors and the reply composer", () => {
    set("thread", { data: threadData() });
    const { container } = render(<ThreadView threadId="t1" page={1} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "<b>Plain</b> title" })
    ).toBeInTheDocument();
    expect(container.querySelector("#post-p1")).toHaveTextContent("First post");
    expect(container.querySelector("#post-p2")).toHaveTextContent("In character");
    expect(screen.getByText("Kir")).toBeInTheDocument();
    expect(screen.getByText("Aria Vance")).toBeInTheDocument();
    expect(screen.getByText("@aria")).toBeInTheDocument();
    expect(screen.queryByText("Hidden Player")).toBeNull();
    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
    expect(screen.queryByText("This thread is locked.")).toBeNull();
  });

  it("hides the reply composer and edit when locked", () => {
    set("thread", {
      data: threadData({ locked: true, canReply: false }),
    });
    render(<ThreadView threadId="t1" page={1} />);
    expect(screen.getByText("This thread is locked.")).toBeInTheDocument();
    expect(screen.queryByTestId("composer")).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("edits only the viewer's own post, prefilled, and saves through editPost", async () => {
    set("thread", { data: threadData() });
    const editPost = jest.fn(() => Promise.resolve({}));
    mutations.editPost = editPost;
    render(<ThreadView threadId="t1" page={1} />);
    const edits = screen.getAllByRole("button", { name: "Edit" });
    expect(edits).toHaveLength(1);
    fireEvent.click(edits[0]!);
    const editor = screen.getAllByTestId("composer")[0]!;
    expect(editor).toHaveAttribute("data-initial", "<p>First post</p>");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(editPost).toHaveBeenCalledWith({ postId: "p1", html: "<p>new</p>" })
    );
  });

  it("after a reply goes to the reply's page and anchor", async () => {
    set("thread", { data: threadData() });
    const reply = jest.fn(() => Promise.resolve({ postId: "p9" }));
    mutations.reply = reply;
    render(<ThreadView threadId="t1" page={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/thinkpages/t/t1?page=3#post-p9")
    );
    expect(reply).toHaveBeenCalledWith({ threadId: "t1", html: "<p>new</p>", personaId: null });
  });
});

describe("load failures and out-of-range pages", () => {
  it("says Category not found only for NOT_FOUND", () => {
    set("category", { data: undefined, error: { data: { code: "NOT_FOUND" } } });
    render(<ThreadList categoryKey="secret" page={1} />);
    expect(screen.getByText("Category not found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("offers Retry for any other category error", () => {
    const refetch = jest.fn();
    set("category", {
      data: undefined,
      error: { data: { code: "INTERNAL_SERVER_ERROR" } },
      refetch,
    });
    render(<ThreadList categoryKey="general" page={1} />);
    expect(screen.queryByText("Category not found")).toBeNull();
    expect(screen.getByText("Could not load this page")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("says Thread not found only for NOT_FOUND, and Retry otherwise", () => {
    set("thread", { data: undefined, error: { data: { code: "NOT_FOUND" } } });
    const { unmount } = render(<ThreadView threadId="gone" page={1} />);
    expect(screen.getByText("Thread not found")).toBeInTheDocument();
    unmount();

    const refetch = jest.fn();
    set("thread", { data: undefined, error: { data: { code: "TIMEOUT" } }, refetch });
    render(<ThreadView threadId="t1" page={1} />);
    expect(screen.queryByText("Thread not found")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("sends a category page past the end to the last page", () => {
    set("category", { data: { ...categoryData(false), total: 30 } });
    render(<ThreadList categoryKey="general" page={5} />);
    expect(router.replace).toHaveBeenCalledWith("/thinkpages/c/general?page=2");
    expect(screen.queryByText("No threads yet")).toBeNull();
  });

  it("sends a thread page past the end to the last page", () => {
    set("thread", { data: { ...threadData(), posts: [] } });
    render(<ThreadView threadId="t1" page={4} />);
    expect(router.replace).toHaveBeenCalledWith("/thinkpages/t/t1?page=1");
    expect(screen.queryByTestId("composer")).toBeNull();
  });

  it("keeps an empty category on its page without redirecting", () => {
    set("category", { data: categoryData(false) });
    render(<ThreadList categoryKey="general" page={3} />);
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByText("No threads yet")).toBeInTheDocument();
  });
});

describe("new thread", () => {
  it("creates the thread and opens it", async () => {
    set("category", { data: categoryData(true) });
    const create = jest.fn(() => Promise.resolve({ threadId: "t7", postId: "p7" }));
    mutations.createThread = create;
    render(<NewThreadForm categoryKey="general" />);
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/thinkpages/t/t7"));
    expect(create).toHaveBeenCalledWith({
      categoryKey: "general",
      title: "Hello",
      html: "<p>new</p>",
      personaId: null,
    });
  });
});

describe("post permalink", () => {
  async function renderPermalink(postId: string) {
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <PostPage params={Promise.resolve({ postId })} />
        </Suspense>
      );
    });
  }

  it("redirects a forum post to its thread page and anchor", async () => {
    set("resolvePost", {
      data: { threadId: "t1", page: 2 },
    });
    await renderPermalink("p5");
    expect(router.replace).toHaveBeenCalledWith("/thinkpages/t/t1?page=2#post-p5");
    expect(screen.queryByText("Post not found")).toBeNull();
  });

  it("does not flash the feed not-found state while resolving", async () => {
    set("resolvePost", { isLoading: true });
    await renderPermalink("p5");
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
    expect(screen.queryByText("Post not found")).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("renders the feed post as before when the id is not a forum post", async () => {
    set("resolvePost", { data: null });
    set("getPost", { data: null });
    await renderPermalink("feed1");
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByText("Post not found")).toBeInTheDocument();
  });
});
