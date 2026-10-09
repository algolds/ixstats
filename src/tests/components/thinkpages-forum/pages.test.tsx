import React, { Suspense } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

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
        thinkpages: { getPost: { invalidate: jest.fn() }, getFeed: { invalidate: jest.fn() } },
      }),
      thinkpagesForum: {
        categories: query("categories"),
        realms: query("realms"),
        realmSection: query("realmSection"),
        category: query("category"),
        thread: query("thread"),
        resolvePost: query("resolvePost"),
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
  return { router, useRouter: () => router, redirect: jest.fn() };
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
import ForumHomePage from "~/app/thinkpages/forum/page";
import RealmRedirectPage from "~/app/thinkpages/r/[realm]/page";

const { results, inputs, mutations } = jest.requireMock<MockApi>("~/trpc/react");
const { router, redirect } = jest.requireMock<{
  router: { push: jest.Mock; replace: jest.Mock };
  redirect: jest.Mock;
}>("next/navigation");

const authors = {
  users: { u1: { name: "Kir", handle: "kir" }, u2: { name: "Hidden Player", handle: null } },
  personas: { pa: { displayName: "Aria Vance", username: "aria" } },
};

const EURTH = { slug: "eurth", name: "Eurth" };
const HUB = { key: "hub", name: "Hub", description: "Realm talk", icAllowed: false, realm: EURTH };

function threadData(
  overrides: { locked?: boolean; canReply?: boolean; realm?: typeof EURTH } = {}
) {
  return {
    thread: {
      id: "t1",
      title: "<b>Plain</b> title",
      locked: overrides.locked ?? false,
      archived: false,
    },
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

function categoryData(
  canStart: boolean,
  threads: object[] = [],
  category: object = { key: "general", name: "General", description: "Talk", icAllowed: false },
  notice: string | null = null
) {
  return { category, threads, total: threads.length, canStart, notice, authors };
}

/** The breadcrumb trail's labels and hrefs (the current page has none). */
function crumbs() {
  const trail = screen.getByRole("navigation", { name: "breadcrumb" });
  return within(trail)
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);
}

const realmSection = {
  realm: { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active" },
  categories: [
    {
      key: "hub",
      name: "Hub",
      description: "Realm talk",
      icAllowed: false,
      postRole: "any",
      threadCount: 4,
      lastPostAt: null,
    },
  ],
  canPost: true,
  notice: null,
};
const realmList = { defaultSlug: "ixworld", realms: [{ id: "r_eurth", ...EURTH }] };

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

  it("also shows the realm section, opening the realm in ?realm=", async () => {
    set("categories", { data: [] });
    set("realms", { data: realmList });
    set("realmSection", { data: realmSection });
    render(await ForumHomePage({ searchParams: Promise.resolve({ realm: "eurth" }) }));
    expect(inputs.realmSection).toEqual({ realm: "eurth" });
    expect(screen.getByRole("heading", { level: 2, name: "Eurth" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Hub/ })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth/hub"
    );
  });

  it("sends /thinkpages/r/<realm> to the home with that realm", async () => {
    await RealmRedirectPage({ params: Promise.resolve({ realm: "eurth" }) });
    expect(redirect).toHaveBeenCalledWith("/thinkpages/forum?realm=eurth");
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

  it("explains why New thread is missing with the category's notice", () => {
    const notice = "Your nation is muted on this board until Jan 1.";
    set("category", { data: categoryData(false, [], undefined, notice) });
    const { rerender } = render(<ThreadList categoryKey="general" page={1} />);
    expect(screen.getByText(notice)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /New thread/ })).toBeNull();

    set("category", { data: categoryData(true, [], undefined, notice) });
    rerender(<ThreadList categoryKey="general" page={1} />);
    expect(screen.queryByText(notice)).toBeNull();

    set("category", { data: categoryData(false) });
    rerender(<ThreadList categoryKey="general" page={1} />);
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
    render(<ThreadList categoryKey="general" page={1} />);
    expect(screen.getByText("<i>Hi</i>")).toBeInTheDocument();
    expect(screen.getByText("Aria Vance")).toBeInTheDocument();
    expect(screen.queryByText("Hidden Player")).toBeNull();
    expect(screen.getByText("2 replies")).toBeInTheDocument();
  });

  it("breadcrumbs a sitewide category as Forum, then the category", () => {
    set("category", { data: categoryData(false) });
    render(<ThreadList categoryKey="general" page={1} />);
    expect(crumbs()).toEqual([
      ["Forum", "/thinkpages/forum"],
      ["General", null],
    ]);
  });

  it("scopes a realm category to its realm: query, New thread and breadcrumbs", () => {
    set("category", { data: categoryData(true, [], HUB) });
    render(<ThreadList categoryKey="hub" realm="eurth" page={1} />);
    expect(inputs.category).toEqual({ key: "hub", page: 1, realm: "eurth" });
    expect(screen.getByRole("link", { name: /New thread/ })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth/hub/new"
    );
    expect(crumbs()).toEqual([
      ["Forum", "/thinkpages/forum"],
      ["Eurth", "/thinkpages/forum?realm=eurth"],
      ["Hub", null],
    ]);
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

  it("breadcrumbs a sitewide thread without a realm crumb", () => {
    set("thread", { data: threadData() });
    render(<ThreadView threadId="t1" page={1} />);
    expect(crumbs()).toEqual([
      ["Forum", "/thinkpages/forum"],
      ["General", "/thinkpages/c/general"],
      ["<b>Plain</b> title", null],
    ]);
  });

  it("breadcrumbs a realm thread through its realm and category", () => {
    set("thread", { data: threadData({ realm: EURTH }) });
    render(<ThreadView threadId="t1" page={1} />);
    expect(crumbs()).toEqual([
      ["Forum", "/thinkpages/forum"],
      ["Eurth", "/thinkpages/forum?realm=eurth"],
      ["Hub", "/thinkpages/r/eurth/hub"],
      ["<b>Plain</b> title", null],
    ]);
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

  it("starts a realm thread in that realm", async () => {
    set("category", { data: categoryData(true, [], HUB) });
    const create = jest.fn(() => Promise.resolve({ threadId: "t8", postId: "p8" }));
    mutations.createThread = create;
    render(<NewThreadForm categoryKey="hub" realm="eurth" />);
    expect(inputs.category).toEqual({ key: "hub", page: 1, realm: "eurth" });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/thinkpages/t/t8"));
    expect(create).toHaveBeenCalledWith({
      categoryKey: "hub",
      realm: "eurth",
      title: "Hello",
      html: "<p>new</p>",
      personaId: null,
    });
  });

  it("explains a refusal with the category's notice, else the general copy", () => {
    const notice = "Only owners of a nation in Eurth can post here.";
    set("category", { data: categoryData(false, [], HUB, notice) });
    const { unmount } = render(<NewThreadForm categoryKey="hub" realm="eurth" />);
    expect(screen.getByText(notice)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the forum" })).toHaveAttribute(
      "href",
      "/thinkpages/forum?realm=eurth"
    );
    unmount();

    set("category", { data: categoryData(false) });
    render(<NewThreadForm categoryKey="general" />);
    expect(screen.getByText("Sign in, or pick a category open to members.")).toBeInTheDocument();
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
