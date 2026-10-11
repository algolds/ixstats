import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

interface QueryResult {
  data?: object | null;
  isLoading?: boolean;
  error?: { data?: { code: string } } | null;
}

interface MockApi {
  results: Record<string, QueryResult>;
  inputs: Record<string, unknown>;
  mutations: Record<string, jest.Mock>;
  invalidated: string[];
}

jest.mock("~/trpc/react", () => {
  const results: Record<string, QueryResult> = {};
  const inputs: Record<string, unknown> = {};
  const mutations: Record<string, jest.Mock> = {};
  const invalidated: string[] = [];
  const invalidator = (name: string) => ({
    invalidate: () => {
      invalidated.push(name);
      return Promise.resolve();
    },
  });
  const query = (name: string) => ({
    useQuery: (input?: unknown) => {
      inputs[name] = input;
      return { isLoading: false, error: null, ...results[name] };
    },
  });
  return {
    results,
    inputs,
    mutations,
    invalidated,
    api: {
      useUtils: () => ({
        thinkpagesForum: {
          newPosts: invalidator("newPosts"),
          watchedThreads: invalidator("watchedThreads"),
          navCounts: invalidator("navCounts"),
          category: invalidator("category"),
          categories: invalidator("categories"),
          realmSection: invalidator("realmSection"),
        },
      }),
      thinkpagesForum: {
        markCategoryRead: {
          useMutation: () => ({ mutateAsync: mutations.markCategoryRead, isPending: false }),
        },
        category: query("category"),
        realms: query("realms"),
        categories: query("categories"),
        realmSection: query("realmSection"),
        boardTopPosters: query("boardTopPosters"),
      },
    },
  };
});

jest.mock("next/navigation", () => {
  const router = { push: jest.fn(), replace: jest.fn() };
  return { router, useRouter: () => router, usePathname: () => "/thinkpages/c/general" };
});

jest.mock("~/components/thinkpages-forum/advert/AdvertBoardAction", () => ({
  AdvertBoardAction: () => <button type="button">Advertise stub</button>,
}));

jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));

jest.mock("~/context/auth-context", () => {
  const auth = { isSignedIn: false };
  return { auth, useUser: () => ({ user: null, isSignedIn: auth.isSignedIn }) };
});

const mockNotify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => mockNotify }));

// Radix Select and DropdownMenu open on pointer events jsdom does not model; render their items inline.
jest.mock("~/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: () => <span data-testid="realm-switcher" />,
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}));

jest.mock("~/components/ui/dropdown-menu", () => {
  const { createContext, useContext } = jest.requireActual<typeof React>("react");
  const Ctx = createContext<(value: string) => void>(() => undefined);
  return {
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
      <div role="menu">{children}</div>
    ),
    DropdownMenuRadioGroup: ({
      children,
      onValueChange,
    }: {
      children: React.ReactNode;
      onValueChange: (value: string) => void;
    }) => <Ctx.Provider value={onValueChange}>{children}</Ctx.Provider>,
    DropdownMenuRadioItem: ({ children, value }: { children: React.ReactNode; value: string }) => {
      const choose = useContext(Ctx);
      return (
        <button type="button" role="menuitemradio" onClick={() => choose(value)}>
          {children}
        </button>
      );
    },
  };
});

import { BoardPage } from "~/components/thinkpages-forum/board";

const { results, inputs } = jest.requireMock<MockApi>("~/trpc/react");
const { router } = jest.requireMock<{ router: { push: jest.Mock; replace: jest.Mock } }>(
  "next/navigation"
);

const originalMatchMedia = window.matchMedia;

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
  users: { u1: { name: "Kir", handle: "kir", avatarUrl: null, flagUrl: null } },
  personas: {},
};

function thread(id: string) {
  return {
    id,
    title: `Thread ${id}`,
    authorUserId: "u1",
    authorPersonaId: null,
    importedAuthorName: null,
    xenforoThreadId: null,
    pinned: false,
    locked: false,
    hidden: false,
    postCount: 3,
    lastPostAt: new Date(),
  };
}

function board(
  extra: { category?: object; threads?: object[]; total?: number; canStart?: boolean } = {}
) {
  const threads = extra.threads ?? [thread("t1")];
  return {
    category: {
      key: "general",
      name: "General",
      description: "Out-of-character talk about anything.",
      icAllowed: false,
      postRole: "any",
      visibility: "public",
      style: "ooc",
      realm: null,
      ...extra.category,
    },
    threads,
    total: extra.total ?? threads.length,
    canStart: extra.canStart ?? true,
    notice: null,
    banned: false,
    authors,
  };
}

function set(name: string, result: QueryResult) {
  results[name] = result;
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(results)) delete results[key];
  installViewport(true);
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("BoardPage", () => {
  it("asks for the page and the sort it was given", () => {
    set("category", { data: board() });
    render(<BoardPage categoryKey="general" page={2} sort="replies" />);
    expect(inputs.category).toEqual({ key: "general", page: 2, realm: undefined, sort: "replies" });
  });

  it("shows the In character pill in the header only for an IC board", () => {
    set("category", { data: board({ category: { style: "ic" } }) });
    const { unmount } = render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    // In the header and in About this board.
    expect(screen.getAllByText("In character")).toHaveLength(2);
    unmount();

    set("category", { data: board() });
    render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.queryByText("In character")).toBeNull();
  });

  it("shows New thread in the header, and in the empty state, only when the viewer can start one", () => {
    set("category", { data: board({ threads: [], canStart: true }) });
    const { unmount } = render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.getByText("No threads yet")).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: /New thread/ })) {
      expect(link).toHaveAttribute("href", "/thinkpages/c/general/new");
    }
    expect(screen.getAllByRole("link", { name: /New thread/ })).toHaveLength(2);
    unmount();

    set("category", { data: board({ threads: [], canStart: false }) });
    render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.queryByRole("link", { name: /New thread/ })).toBeNull();
  });

  it("puts windowed pagination above and below the table, keeping the sort", () => {
    set("category", { data: board({ total: 90 }) });
    render(<BoardPage categoryKey="general" page={2} sort="replies" />);
    const navs = screen.getAllByRole("navigation", { name: "Pagination" });
    expect(navs).toHaveLength(2);
    const table = screen.getByRole("table");
    expect(navs[0]!.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(table.compareDocumentPosition(navs[1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(navs[0]!).getAllByRole("link", { name: "3" })[0]).toHaveAttribute(
      "href",
      "/thinkpages/c/general?sort=replies&page=3"
    );
  });

  it("offers the sort in a header menu for phones", () => {
    set("category", { data: board() });
    render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Most replies" }));
    expect(router.push).toHaveBeenCalledWith("/thinkpages/c/general?sort=replies");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Latest activity" }));
    expect(router.push).toHaveBeenLastCalledWith("/thinkpages/c/general");
  });
});

describe("BoardPage realm boards", () => {
  const eurth = { slug: "eurth", name: "Eurth" };
  const hub = { key: "hub", name: "Hub", realm: eurth };

  it("keeps the realm switcher in the header, and has none on a sitewide board", () => {
    set("category", { data: board({ category: hub }) });
    set("realms", { data: { defaultSlug: "eurth", realms: [{ id: "r1", ...eurth }] } });
    const { unmount } = render(
      <BoardPage categoryKey="hub" realm="eurth" page={1} sort="latest" />
    );
    expect(screen.getByTestId("realm-switcher")).toBeInTheDocument();
    expect(inputs.category).toEqual({ key: "hub", page: 1, realm: "eurth", sort: "latest" });
    unmount();

    set("category", { data: board() });
    render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.queryByTestId("realm-switcher")).toBeNull();
  });
});

describe("BoardPage rail", () => {
  it("describes the board: description, In character pill and the posting rule", () => {
    set("category", {
      data: board({
        category: { style: "ic", postRole: "staff", description: "News from the team." },
      }),
    });
    render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    const about = screen.getByText("About this board").closest('[data-slot="card"]') as HTMLElement;
    expect(within(about).getByText("News from the team.")).toBeInTheDocument();
    expect(within(about).getByText("In character")).toBeInTheDocument();
    expect(within(about).getByText("Only staff can start threads here.")).toBeInTheDocument();
  });

  it("says any member can start threads on an open board", () => {
    set("category", { data: board() });
    render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.getByText("Any member can start threads here.")).toBeInTheDocument();
  });

  it("lists this month's top posters, and hides the panel when there are none", () => {
    set("category", { data: board() });
    set("boardTopPosters", {
      data: { posters: [{ authorUserId: "u1", postCount: 12 }], authors },
    });
    const { unmount } = render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    const panel = screen
      .getByText("Top posters this month")
      .closest('[data-slot="card"]') as HTMLElement;
    expect(within(panel).getByText("Kir")).toBeInTheDocument();
    expect(within(panel).getByText("12 posts")).toBeInTheDocument();
    unmount();

    set("boardTopPosters", { data: { posters: [], authors } });
    render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.queryByText("Top posters this month")).toBeNull();
  });
});

describe("BoardPage read state", () => {
  const { mutations, invalidated } = jest.requireMock<MockApi>("~/trpc/react");
  const { auth } = jest.requireMock<{ auth: { isSignedIn: boolean } }>("~/context/auth-context");

  beforeEach(() => {
    invalidated.length = 0;
    auth.isSignedIn = true;
    mutations.markCategoryRead = jest.fn().mockResolvedValue({ marked: 1 });
  });
  afterEach(() => {
    auth.isSignedIn = false;
  });

  it("shows an unread thread in bold and offers Mark board read, which marks the board and refreshes", async () => {
    set("category", {
      data: board({ threads: [{ ...thread("t1"), unread: true }, thread("t2")] }),
    });
    render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.getByRole("link", { name: "Thread t1" })).toHaveClass("font-bold");
    fireEvent.click(screen.getByRole("button", { name: "Mark board read" }));
    await waitFor(() =>
      expect(mutations.markCategoryRead).toHaveBeenCalledWith({ key: "general", realm: undefined })
    );
    await waitFor(() =>
      expect(invalidated).toEqual(expect.arrayContaining(["category", "categories", "navCounts"]))
    );
  });

  it("marks a realm board by its realm", async () => {
    set("category", {
      data: board({
        category: { key: "hub", name: "Hub", realm: { slug: "eurth", name: "Eurth" } },
        threads: [{ ...thread("t1"), unread: true }],
      }),
    });
    render(<BoardPage categoryKey="hub" realm="eurth" page={1} sort="latest" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark board read" }));
    await waitFor(() =>
      expect(mutations.markCategoryRead).toHaveBeenCalledWith({ key: "hub", realm: "eurth" })
    );
  });

  it("reports a refusal and refreshes nothing", async () => {
    mutations.markCategoryRead = jest.fn().mockRejectedValue(new Error("Category not found."));
    set("category", { data: board({ threads: [{ ...thread("t1"), unread: true }] }) });
    render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark board read" }));
    await waitFor(() =>
      expect(mockNotify.error).toHaveBeenCalledWith(
        "Could not mark the board read",
        "Category not found."
      )
    );
    expect(invalidated).toEqual([]);
  });

  it("bases Mark board read on the board's own unread count, not on the page shown", () => {
    // Nothing unread on this page, but the board has unread threads on another one.
    set("category", { data: board() });
    set("categories", { data: [{ key: "general", unreadThreads: 4 }] });
    render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.getByRole("button", { name: "Mark board read" })).toBeEnabled();
  });

  it("reads a realm board's count from the realm's boards", () => {
    set("category", {
      data: board({
        category: { key: "hub", name: "Hub", realm: { slug: "eurth", name: "Eurth" } },
      }),
    });
    set("realmSection", { data: { categories: [{ key: "hub", unreadThreads: 0 }] } });
    set("categories", { data: [{ key: "hub", unreadThreads: 9 }] });
    const { unmount } = render(
      <BoardPage categoryKey="hub" realm="eurth" page={1} sort="latest" />
    );
    expect(screen.getByRole("button", { name: "Mark board read" })).toBeDisabled();
    unmount();
    set("realmSection", { data: { categories: [{ key: "hub", unreadThreads: 3 }] } });
    render(<BoardPage categoryKey="hub" realm="eurth" page={1} sort="latest" />);
    expect(screen.getByRole("button", { name: "Mark board read" })).toBeEnabled();
  });

  it("leaves Mark board read enabled while the board's count is unknown", () => {
    set("category", { data: board() });
    render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.getByRole("button", { name: "Mark board read" })).toBeEnabled();
  });

  it("disables Mark board read when nothing is unread, and shows it to nobody signed out", () => {
    set("category", { data: board() });
    set("categories", { data: [{ key: "general", unreadThreads: 0 }] });
    const { unmount } = render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.getByRole("button", { name: "Mark board read" })).toBeDisabled();
    unmount();
    auth.isSignedIn = false;
    render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.queryByRole("button", { name: "Mark board read" })).toBeNull();
  });
});

describe("BoardPage in Find a Realm", () => {
  const find = { key: "find-a-realm", name: "Find a Realm", scope: "site" };

  it("replaces New thread with the advert action and says who posts adverts", () => {
    set("category", { data: board({ category: find, canStart: false }) });
    render(<BoardPage categoryKey="find-a-realm" page={1} sort="latest" />);
    expect(screen.getByRole("button", { name: "Advertise stub" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /New thread/ })).toBeNull();
    expect(screen.getByText(/founder and officers post its advert/i)).toBeInTheDocument();
  });

  it("names adverts in the empty state and offers the advert action, never New thread", () => {
    set("category", { data: board({ category: find, threads: [], canStart: true }) });
    render(<BoardPage categoryKey="find-a-realm" page={1} sort="latest" />);
    expect(screen.getByText("Realm adverts will appear here")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Advertise stub" })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /New thread/ })).toBeNull();
    expect(screen.queryByText("Be the first to post")).toBeNull();
  });

  it("leaves every other board as it was", () => {
    set("category", { data: board() });
    render(<BoardPage categoryKey="general" page={1} sort="latest" />);
    expect(screen.queryByRole("button", { name: "Advertise stub" })).toBeNull();
    expect(screen.queryByText(/post its advert/i)).toBeNull();
    expect(screen.getByRole("link", { name: /New thread/ })).toBeInTheDocument();
  });

  it("does not treat a realm's board with that key as Find a Realm", () => {
    set("category", { data: board({ category: { key: "find-a-realm", scope: "realm" } }) });
    render(<BoardPage categoryKey="find-a-realm" realm="eurth" page={1} sort="latest" />);
    expect(screen.queryByRole("button", { name: "Advertise stub" })).toBeNull();
    expect(screen.queryByText(/post its advert/i)).toBeNull();
  });
});
