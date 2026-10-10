import React from "react";
import { fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";

interface QueryResult {
  data?: object | null;
  isLoading?: boolean;
  error?: { data?: { code: string } } | null;
}
interface MockApi {
  results: Record<string, QueryResult>;
  mutations: Record<string, jest.Mock>;
  invalidated: string[];
}

jest.mock("~/trpc/react", () => {
  const results: Record<string, QueryResult> = {};
  const mutations: Record<string, jest.Mock> = {};
  const invalidated: string[] = [];
  const query = (name: string) => ({
    useQuery: () => ({ isLoading: false, error: null, refetch: jest.fn(), ...results[name] }),
  });
  const mutation = (name: string) => ({
    useMutation: () => ({ mutateAsync: mutations[name], isPending: false }),
  });
  const names = [
    "newPosts",
    "watchedThreads",
    "navCounts",
    "category",
    "categories",
    "realmSection",
    "thread",
    "stashedThreads",
    "isThreadStashed",
  ];
  const utils = Object.fromEntries(
    names.map((name) => [
      name,
      {
        invalidate: () => {
          invalidated.push(name);
          return Promise.resolve();
        },
      },
    ])
  );
  return {
    results,
    mutations,
    invalidated,
    api: {
      useUtils: () => ({ thinkpagesForum: utils }),
      thinkpagesForum: {
        newPosts: query("newPosts"),
        watchedThreads: query("watchedThreads"),
        stashedThreads: query("stashedThreads"),
        markAllRead: mutation("markAllRead"),
        watchThread: mutation("watchThread"),
        unwatchThread: mutation("unwatchThread"),
        unstashThread: mutation("unstashThread"),
      },
    },
  };
});
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
  usePathname: () => "/thinkpages/new",
}));
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));
jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
  return { useNotify: () => notify, notifySpy: notify };
});
jest.mock("~/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  AvatarImage: () => null,
  AvatarFallback: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

import { NewPostsPage, StashedPage, WatchedPage } from "~/components/thinkpages-forum/lists";
import { useWatchToggle } from "~/components/thinkpages-forum/useWatchToggle";

const { results, mutations, invalidated } = jest.requireMock<MockApi>("~/trpc/react");
const { notifySpy } = jest.requireMock<{ notifySpy: { error: jest.Mock } }>("~/hooks/useNotify");
const authors = {
  users: { u1: { name: "Kir", handle: "kir", avatarUrl: null, flagUrl: null } },
  personas: {},
};

function listed(id: string, over: object = {}) {
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
    postCount: 4,
    lastPostAt: new Date(),
    unread: true,
    board: { key: "general", name: "General", realm: null },
    lastPoster: null,
    ...over,
  };
}

beforeEach(() => {
  for (const key of Object.keys(results)) delete results[key];
  invalidated.length = 0;
  notifySpy.error.mockClear();
  mockReplace.mockClear();
  mutations.markAllRead = jest.fn().mockResolvedValue({ allReadAt: new Date() });
  mutations.watchThread = jest.fn().mockResolvedValue({ watching: true });
  mutations.unwatchThread = jest.fn().mockResolvedValue({ watching: false });
  mutations.unstashThread = jest.fn().mockResolvedValue({ success: true });
});

describe("NewPostsPage", () => {
  it("lists unread threads with their board, each opening at the first unread post", () => {
    results.newPosts = { data: { threads: [listed("t1")], total: 1, authors } };
    render(<NewPostsPage page={1} />);
    expect(screen.getByRole("link", { name: "Thread t1" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t1/unread"
    );
    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("1 unread thread")).toBeInTheDocument();
  });

  it("says so when everything is read", () => {
    results.newPosts = { data: { threads: [], total: 0, authors } };
    render(<NewPostsPage page={1} />);
    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark all read" })).toBeDisabled();
  });

  it("marks everything read and refreshes the lists and counts", async () => {
    results.newPosts = { data: { threads: [listed("t1")], total: 1, authors } };
    render(<NewPostsPage page={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    await waitFor(() => expect(mutations.markAllRead).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(invalidated).toEqual(
        expect.arrayContaining(["newPosts", "navCounts", "category", "categories"])
      )
    );
  });

  it("reports one error and refreshes nothing when marking everything read fails", async () => {
    results.newPosts = { data: { threads: [listed("t1")], total: 1, authors } };
    mutations.markAllRead = jest.fn().mockRejectedValue(new Error("Nope"));
    render(<NewPostsPage page={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    await waitFor(() =>
      expect(notifySpy.error).toHaveBeenCalledWith("Could not mark everything read", "Nope")
    );
    expect(invalidated).toEqual([]);
  });

  it("replaces a page past the end with the last page while showing a loader", () => {
    results.newPosts = { data: { threads: [], total: 60, authors } };
    render(<NewPostsPage page={9} />);
    expect(mockReplace).toHaveBeenCalledWith("/thinkpages/new?page=3");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("pages by 25 with real links", () => {
    results.newPosts = { data: { threads: [listed("t1")], total: 60, authors } };
    render(<NewPostsPage page={1} />);
    expect(screen.getAllByRole("link", { name: "Next" })[0]).toHaveAttribute(
      "href",
      "/thinkpages/new?page=2"
    );
  });
});

describe("WatchedPage", () => {
  it("lists watched threads, each with an Unwatch control that refreshes the list and the count", async () => {
    results.watchedThreads = {
      data: { threads: [listed("t1", { unread: false })], total: 1, authors },
    };
    render(<WatchedPage page={1} />);
    const row = screen.getByRole("row", { name: /Thread t1/ });
    expect(within(row).getByRole("link", { name: "Thread t1" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t1"
    );
    fireEvent.click(within(row).getByRole("button", { name: "Unwatch Thread t1" }));
    await waitFor(() => expect(mutations.unwatchThread).toHaveBeenCalledWith({ threadId: "t1" }));
    await waitFor(() =>
      expect(invalidated).toEqual(expect.arrayContaining(["watchedThreads", "navCounts", "thread"]))
    );
  });

  it("reports one error and refreshes nothing when Unwatch fails", async () => {
    results.watchedThreads = { data: { threads: [listed("t1")], total: 1, authors } };
    mutations.unwatchThread = jest.fn().mockRejectedValue(new Error("Nope"));
    render(<WatchedPage page={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Unwatch Thread t1" }));
    await waitFor(() =>
      expect(notifySpy.error).toHaveBeenCalledWith("Could not update watching", "Nope")
    );
    expect(invalidated).toEqual([]);
  });

  it("says so when nothing is watched", () => {
    results.watchedThreads = { data: { threads: [], total: 0, authors } };
    render(<WatchedPage page={1} />);
    expect(screen.getByText("Watch a thread to follow its replies here.")).toBeInTheDocument();
  });
});

describe("useWatchToggle", () => {
  it("watches a thread and refreshes the lists, the count and the thread", async () => {
    const { result } = renderHook(() => useWatchToggle());
    await expect(result.current.setWatching("t1", true)).resolves.toBe(true);
    expect(mutations.watchThread).toHaveBeenCalledWith({ threadId: "t1" });
    expect(mutations.unwatchThread).not.toHaveBeenCalled();
    expect(invalidated).toEqual(expect.arrayContaining(["watchedThreads", "navCounts", "thread"]));
  });

  it("reports one error and resolves false when watching fails", async () => {
    mutations.watchThread = jest.fn().mockRejectedValue(new Error("Nope"));
    const { result } = renderHook(() => useWatchToggle());
    await expect(result.current.setWatching("t1", true)).resolves.toBe(false);
    expect(notifySpy.error).toHaveBeenCalledWith("Could not update watching", "Nope");
    expect(invalidated).toEqual([]);
  });
});

describe("StashedPage", () => {
  it("lists stashed threads with an Unstash control", async () => {
    results.stashedThreads = {
      data: [
        {
          id: "i1",
          threadId: "t1",
          title: "Saved thread",
          href: "/thinkpages/t/t1",
          savedAt: new Date(),
        },
      ],
    };
    render(<StashedPage />);
    expect(screen.getByRole("link", { name: "Saved thread" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t1"
    );
    fireEvent.click(screen.getByRole("button", { name: "Unstash Saved thread" }));
    await waitFor(() => expect(mutations.unstashThread).toHaveBeenCalledWith({ threadId: "t1" }));
    await waitFor(() =>
      expect(invalidated).toEqual(expect.arrayContaining(["stashedThreads", "isThreadStashed"]))
    );
  });

  it("says so when nothing is stashed", () => {
    results.stashedThreads = { data: [] };
    render(<StashedPage />);
    expect(screen.getByText("Nothing stashed yet")).toBeInTheDocument();
  });
});
