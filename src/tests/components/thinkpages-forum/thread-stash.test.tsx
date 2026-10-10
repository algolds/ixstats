import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

interface MockApi {
  stashed: { data?: { stashed: boolean }; isLoading?: boolean; isError?: boolean };
  mutations: { stashThread: jest.Mock; unstashThread: jest.Mock };
  invalidate: jest.Mock;
}

jest.mock("~/trpc/react", () => {
  const stashed: { data?: { stashed: boolean }; isLoading?: boolean; isError?: boolean } = {};
  const mutations = { stashThread: jest.fn(), unstashThread: jest.fn() };
  const invalidate = jest.fn(() => Promise.resolve());
  const mutation = (name: "stashThread" | "unstashThread") => ({
    useMutation: () => ({ mutateAsync: mutations[name], isPending: false }),
  });
  const thread = {
    thread: {
      id: "t1",
      title: "Hello",
      locked: false,
      archived: false,
      hidden: false,
      postCount: 0,
      lastPostAt: new Date(),
      createdAt: new Date(),
    },
    style: "ooc",
    participants: [],
    category: { key: "general", name: "General", icAllowed: false, realm: null },
    posts: [],
    total: 0,
    canReply: false,
    canModerate: false,
    viewerIsAuthor: true,
    authors: { users: {}, personas: {} },
  };
  return {
    stashed,
    mutations,
    invalidate,
    api: {
      wikios: { getMissingPages: { useQuery: () => ({ data: undefined }) } },
      useUtils: () => ({
        thinkpagesForum: {
          thread: { invalidate },
          category: { invalidate },
          categories: { invalidate },
          realmSection: { invalidate },
          isThreadStashed: { invalidate },
        },
      }),
      thinkpagesForum: {
        thread: { useQuery: () => ({ isLoading: false, error: null, data: thread }) },
        isThreadStashed: { useQuery: () => ({ ...stashed }) },
        stashThread: mutation("stashThread"),
        unstashThread: mutation("unstashThread"),
        reply: { useMutation: () => ({ mutateAsync: jest.fn() }) },
        editPost: { useMutation: () => ({ mutateAsync: jest.fn() }) },
      },
      thinkpagesForumMod: { editPost: { useMutation: () => ({ mutateAsync: jest.fn() }) } },
    },
  };
});

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/thinkpages/t/t1",
}));
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));
jest.mock("~/hooks/useThreadActionCards", () => ({
  useThreadActionCards: () => ({ cards: new Map(), ready: true, errored: false }),
}));
jest.mock("~/context/auth-context", () => {
  const auth = { isSignedIn: true };
  return { auth, useUser: () => ({ user: null, isSignedIn: auth.isSignedIn }) };
});
jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
  return { notify, useNotify: () => notify };
});
jest.mock("~/components/thinkpages-forum/ReportDialog", () => ({ ReportDialog: () => null }));
jest.mock("~/components/thinkpages-forum/ForumComposer", () => ({ ForumComposer: () => null }));

import { ThreadPage } from "~/components/thinkpages-forum/thread";

const { stashed, mutations, invalidate } = jest.requireMock<MockApi>("~/trpc/react");
const { auth } = jest.requireMock<{ auth: { isSignedIn: boolean } }>("~/context/auth-context");
const { notify } = jest.requireMock<{ notify: { success: jest.Mock; error: jest.Mock } }>(
  "~/hooks/useNotify"
);

beforeEach(() => {
  jest.clearAllMocks();
  auth.isSignedIn = true;
  stashed.data = { stashed: false };
  stashed.isLoading = false;
  stashed.isError = false;
  invalidate.mockImplementation(() => Promise.resolve());
  mutations.stashThread.mockResolvedValue({ success: true, stashId: "s1" });
  mutations.unstashThread.mockResolvedValue({ success: true });
});

describe("the stash button on a thread", () => {
  it("offers a signed-in reader a button that is not pressed until the thread is stashed", () => {
    render(<ThreadPage threadId="t1" page={1} />);
    expect(screen.getByRole("button", { name: "Stash thread" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("shows a stashed thread as pressed", () => {
    stashed.data = { stashed: true };
    render(<ThreadPage threadId="t1" page={1} />);
    expect(screen.getByRole("button", { name: "Stash thread" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("is not offered to anonymous visitors", () => {
    auth.isSignedIn = false;
    render(<ThreadPage threadId="t1" page={1} />);
    expect(screen.queryByRole("button", { name: /Stash/ })).toBeNull();
  });

  it("stashes the thread, refreshes the state and confirms", async () => {
    render(<ThreadPage threadId="t1" page={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Stash thread" }));
    await waitFor(() => expect(mutations.stashThread).toHaveBeenCalledWith({ threadId: "t1" }));
    expect(mutations.unstashThread).not.toHaveBeenCalled();
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith("Saved to your stash"));
    expect(invalidate).toHaveBeenCalledWith({ threadId: "t1" });
  });

  it("unstashes when the thread is already stashed", async () => {
    stashed.data = { stashed: true };
    render(<ThreadPage threadId="t1" page={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Stash thread" }));
    await waitFor(() => expect(mutations.unstashThread).toHaveBeenCalledWith({ threadId: "t1" }));
    expect(mutations.stashThread).not.toHaveBeenCalled();
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith("Removed from your stash"));
  });

  it("waits for the stash state while it loads, but stays usable when that read failed (I6)", () => {
    stashed.data = undefined;
    stashed.isLoading = true;
    const { unmount } = render(<ThreadPage threadId="t1" page={1} />);
    expect(screen.getByRole("button", { name: "Stash thread" })).toBeDisabled();
    unmount();
    stashed.isLoading = false;
    stashed.isError = true;
    render(<ThreadPage threadId="t1" page={1} />);
    expect(screen.getByRole("button", { name: "Stash thread" })).toBeEnabled();
  });

  it("confirms a stash even when refreshing its state fails afterwards (I6)", async () => {
    invalidate.mockImplementation(() => Promise.reject(new Error("network")));
    render(<ThreadPage threadId="t1" page={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Stash thread" }));
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith("Saved to your stash"));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ threadId: "t1" }));
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("says so when the server refuses", async () => {
    mutations.stashThread.mockRejectedValue(new Error("Thread not found."));
    render(<ThreadPage threadId="t1" page={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Stash thread" }));
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith("Could not update your stash", "Thread not found.")
    );
    expect(notify.success).not.toHaveBeenCalled();
  });
});
