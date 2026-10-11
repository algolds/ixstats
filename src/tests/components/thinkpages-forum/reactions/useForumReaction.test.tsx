import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

jest.mock("~/trpc/react", () => {
  const mutations: Record<string, jest.Mock> = {};
  const mutation = (name: string) => ({
    useMutation: () => ({ mutateAsync: (input: object) => mutations[name]!(input) }),
  });
  return {
    mutations,
    api: {
      thinkpagesForum: {
        thread: { key: "thread" },
        getBoard: { key: "getBoard" },
        react: mutation("react"),
        unreact: mutation("unreact"),
      },
    },
  };
});
// The real getQueryKey needs a live tRPC proxy; this stand-in keeps the same `[[router, procedure]]` prefix shape.
jest.mock("@trpc/react-query", () => ({
  getQueryKey: (procedure: { key: string }) => [["thinkpagesForum", procedure.key]],
}));
jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
  return { notify, useNotify: () => notify };
});

import { useForumReaction } from "~/components/thinkpages-forum/reactions/useForumReaction";

const { mutations } = jest.requireMock<{ mutations: Record<string, jest.Mock> }>("~/trpc/react");
const { notify } = jest.requireMock<{ notify: { error: jest.Mock } }>("~/hooks/useNotify");

const THREAD = [
  ["thinkpagesForum", "thread"],
  { input: { threadId: "t1", page: 1 }, type: "query" },
];
const BOARD = [["thinkpagesForum", "getBoard"], { input: { realm: "eurth" }, type: "query" }];
const row = (
  id: string,
  reactions: Record<string, number> = {},
  myReaction: string | null = null
) => ({
  id,
  reactions,
  myReaction,
});
type Rows = Array<ReturnType<typeof row>>;

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const posts = () => (client.getQueryData(THREAD) as { posts: Rows }).posts;
const messages = () => (client.getQueryData(BOARD) as { messages: Rows }).messages;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  client = new QueryClient();
  client.setQueryData(THREAD, { posts: [row("p1", { like: 1 }), row("p2")] });
  client.setQueryData(BOARD, { messages: [row("b1", { fire: 2 }, "fire")] });
  mutations.react = jest.fn();
  mutations.unreact = jest.fn();
  notify.error.mockClear();
});
afterEach(() => client.clear());

describe("useForumReaction", () => {
  it("shows the reaction at once, then takes the server's counts", async () => {
    const call = deferred<{ counts: Record<string, number>; mine: string | null }>();
    mutations.react!.mockReturnValue(call.promise);
    const { result } = renderHook(() => useForumReaction("p1"), { wrapper });
    let done!: Promise<void>;
    act(() => {
      done = result.current.set("fire");
    });
    await waitFor(() =>
      expect(posts()[0]).toMatchObject({ reactions: { like: 1, fire: 1 }, myReaction: "fire" })
    );
    expect(result.current.pending).toBe(true);
    expect(mutations.react).toHaveBeenCalledWith({ postId: "p1", type: "fire" });
    await act(async () => {
      call.resolve({ counts: { like: 1, fire: 3 }, mine: "fire" });
      await done;
    });
    expect(posts()[0]).toMatchObject({ reactions: { like: 1, fire: 3 }, myReaction: "fire" });
    expect(posts()[1]).toMatchObject({ reactions: {}, myReaction: null });
    expect(result.current.pending).toBe(false);
  });

  it("takes a reaction back through unreact and updates a board page", async () => {
    mutations.unreact!.mockResolvedValue({ counts: { fire: 1 }, mine: null });
    const { result } = renderHook(() => useForumReaction("b1"), { wrapper });
    await act(async () => {
      await result.current.set(null);
    });
    expect(mutations.unreact).toHaveBeenCalledWith({ postId: "b1" });
    expect(mutations.react).not.toHaveBeenCalled();
    expect(messages()[0]).toMatchObject({ reactions: { fire: 1 }, myReaction: null });
  });

  it("cancels in-flight reads of the pages that hold the post before patching", async () => {
    mutations.react!.mockResolvedValue({ counts: { like: 1, fire: 1 }, mine: "fire" });
    const cancel = jest.spyOn(client, "cancelQueries");
    const { result } = renderHook(() => useForumReaction("p1"), { wrapper });
    await act(async () => {
      await result.current.set("fire");
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith({ queryKey: THREAD, exact: true });
  });

  it("marks the pages that hold the post stale once settled", async () => {
    mutations.react!.mockResolvedValue({ counts: { like: 1, fire: 1 }, mine: "fire" });
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useForumReaction("p1"), { wrapper });
    await act(async () => {
      await result.current.set("fire");
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: THREAD, exact: true });
  });

  it("puts only that post back when the reaction fails, keeping changes made elsewhere meanwhile", async () => {
    const call = deferred<{ counts: Record<string, number>; mine: string | null }>();
    mutations.react!.mockReturnValue(call.promise);
    const { result } = renderHook(() => useForumReaction("p1"), { wrapper });
    let done!: Promise<void>;
    act(() => {
      done = result.current.set("fire");
    });
    await waitFor(() => expect(posts()[0]).toMatchObject({ myReaction: "fire" }));
    act(() => {
      client.setQueryData(THREAD, {
        posts: [row("p1", { like: 1, fire: 1 }, "fire"), row("p2", { laugh: 4 }, "laugh")],
      });
      client.setQueryData(BOARD, { messages: [row("b1", { fire: 9 }, "fire")] });
    });
    await act(async () => {
      call.reject(new Error("Slow down"));
      await done;
    });
    expect(posts()[0]).toMatchObject({ reactions: { like: 1 }, myReaction: null });
    expect(posts()[1]).toMatchObject({ reactions: { laugh: 4 }, myReaction: "laugh" });
    expect(messages()[0]).toMatchObject({ reactions: { fire: 9 }, myReaction: "fire" });
    expect(notify.error).toHaveBeenCalledWith("Could not update your reaction", "Slow down");
    expect(result.current.pending).toBe(false);
  });

  it("lets the server's counts win over a live board update that arrived mid-request", async () => {
    const call = deferred<{ counts: Record<string, number>; mine: string | null }>();
    mutations.react!.mockReturnValue(call.promise);
    const { result } = renderHook(() => useForumReaction("b1"), { wrapper });
    let done!: Promise<void>;
    act(() => {
      done = result.current.set("like");
    });
    await waitFor(() => expect(messages()[0]).toMatchObject({ myReaction: "like" }));
    act(() => {
      client.setQueryData(BOARD, { messages: [row("b1", { fire: 7 }, "fire")] });
    });
    await act(async () => {
      call.resolve({ counts: { fire: 7, like: 1 }, mine: "like" });
      await done;
    });
    expect(messages()[0]).toMatchObject({ reactions: { fire: 7, like: 1 }, myReaction: "like" });
  });

  it("ignores a second request while one is in flight", async () => {
    const call = deferred<{ counts: Record<string, number>; mine: string | null }>();
    mutations.react!.mockReturnValue(call.promise);
    const { result } = renderHook(() => useForumReaction("p1"), { wrapper });
    let first!: Promise<void>;
    act(() => {
      first = result.current.set("fire");
    });
    await act(async () => {
      await result.current.set("laugh");
    });
    expect(mutations.react).toHaveBeenCalledTimes(1);
    await act(async () => {
      call.resolve({ counts: { like: 1, fire: 1 }, mine: "fire" });
      await first;
    });
  });

  it("does nothing to the caches for a post that is not in them, and still asks the server", async () => {
    mutations.react!.mockResolvedValue({ counts: { like: 1 }, mine: "like" });
    const { result } = renderHook(() => useForumReaction("zzz"), { wrapper });
    await act(async () => {
      await result.current.set("like");
    });
    expect(mutations.react).toHaveBeenCalledWith({ postId: "zzz", type: "like" });
    expect(posts()[0]).toMatchObject({ reactions: { like: 1 } });
    expect(notify.error).not.toHaveBeenCalled();
  });
});
